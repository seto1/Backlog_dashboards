let config =[];

let data = {
	configText: '',
	configError: '',
	panels: [],
	showConfigContent: false,
	done: false,
};

let vm = new Vue({
	el: '#app',
	data: data,
	created: function() {
		let configCookie = Cookies.get('backlog_dashboards_config');
		if (configCookie) {
			config = JSON.parse(configCookie);

			for (let i = 0; i < config.length; i++) {
				if (! this.panels[i]) {
					this.panels[i] = {
						no: i,
						name: config[i].name,
						url: config[i].url,
						activities: [],
					}
				}
				this.loadActivities(i);
			}

			this.configToText();
		} else {
			this.showConfigContent = true;
		}
	},
	methods: {
		saveConfig() {
			this.configError = '';
			let _config = [];
			let lines = this.configText.split(/\n/);
			for (let i = 0; i < lines.length; i++) {
				if (lines[i] === '') continue;
				let words = lines[i].split(/,/);

				if (! words[0] || !words[1] || !words[2]) {
					this.configError = '[スペース名],[スペースurl],[apiKey]の形式で入力してください';
					break;
				}

				words[0] = words[0].trim();
				words[1] = words[1].trim().replace(/\/$/, '');
				words[2] = words[2].trim();

				if (! words[0] || !words[1] || !words[2] || ! words[1].match(/^https?:\/\//)) {
					this.configError = '[スペース名],[スペースurl],[apiKey]の形式で入力してください';
					break;
				}

				_config.push({ 'name': words[0], 'url': words[1], 'apiKey': words[2] });
			}
			if (! this.configError) {
				config = _config;
				Cookies.set('backlog_dashboards_config', config, { expires: 365 });
				location.reload();
			}
		},
		configToText() {
			let configText = '';
			for (let i = 0; i < config.length; i++) {
				configText += config[i].name + ', ' + config[i].url + ', ' + config[i].apiKey + '\n';
			}
			this.configText = configText;
		},
		loadActivities(configNo) {
			// 取得する更新の種別
			let activityTypeIds = [
				1, // 課題の追加
				2, // 課題の更新
				3, // 課題にコメント
			];
			let activityUrlString = 'activityTypeId[]=' + activityTypeIds.join('&activityTypeId[]=');

			let url = config[configNo].url + '/api/v2/space/activities?count=10&apiKey=' + config[configNo].apiKey
				+ '&' + activityUrlString;
			if (config[configNo].maxId) {
				let maxId = config[configNo].maxId - 1;
				url += '&maxId=' + maxId;
			}
			axios.get(url).then(response => {
				let activities = this.convertActivityApiData(config[configNo], response);
				this.panels[configNo]['activities'] = this.panels[configNo]['activities'].concat(activities);
				this.panels = Object.assign({}, this.panels);
			});
		},
		convertActivityApiData(spaceConfig, response) {
			let activities = [];

			for (let i = 0; i < response.data.length; i++) {
				let activity = {};

				if (response.data[i].content.comment) {
					activity.comment_id = response.data[i].content.comment.id;

					if (response.data[i].content.comment.content) {
						activity.comment = this.escape(response.data[i].content.comment.content);
						activity.comment = activity.comment.replace(/\n/g, '<br>');
					}
				}

				activity.summary = response.data[i].content.summary;
				activity.key_id = response.data[i].content.key_id;
				activity.user_icon = this.getUserIcon(spaceConfig, response.data[i].createdUser.id);
				activity.user_name = response.data[i].createdUser.name;
				activity.project_key = response.data[i].project.projectKey;
				activity.created = this.formatDate(response.data[i].created);
				activity.type = response.data[i].type;
				activity.contentExpanded = false;

				spaceConfig.maxId = response.data[i].id;

				let types = {
					1: '課題追加',
					2: '課題更新',
					3: 'コメント',
				};
				activity.type_text = types[activity.type];

				activity.description = response.data[i].content.description;
				if (response.data[i].content.description) {
					activity.description = this.escape(response.data[i].content.description);
					activity.description = activity.description.replace(/\n/g, '<br>');
				}

				activity.changes = [];
				if (response.data[i].content.changes) {
					for (var j = 0; j < response.data[i].content.changes.length; j++) {
						let change = {};
						change.status = this.getStatusText(response.data[i].content.changes[j]);
						activity.changes.push(change);
					}
				}

				activities.push(activity);
			}

			return activities;
		},
		getUserIcon(spaceConfig, userId) {
			return spaceConfig.url + '/api/v2/users/' + userId + '/icon?apiKey=' + spaceConfig.apiKey;
		},
		toggleConfig() {
			this.showConfigContent = ! this.showConfigContent;
		},
		formatDate(unixTime) {
			var date = new Date(unixTime)
			var diff = new Date().getTime() - date.getTime()
			var d = new Date(diff);

			if (d.getUTCFullYear() - 1970) {
				return d.getUTCFullYear() - 1970 + '年前'
			} else if (d.getUTCMonth()) {
				return d.getUTCMonth() + 'ヶ月前'
			} else if (d.getUTCDate() - 1) {
				return d.getUTCDate() - 1 + '日前'
			} else if (d.getUTCHours()) {
				return d.getUTCHours() + '時間前'
			} else if (d.getUTCMinutes()) {
				return d.getUTCMinutes() + '分前'
			} else {
				return d.getUTCSeconds() + '秒前'
			}
		},
		expandContent(activity) {
			activity.contentExpanded = true;
		},
		infiniteScroll(event, panelNo) {
			if ((event.target.scrollTop + event.target.offsetHeight) >= event.target.scrollHeight) {
				this.loadActivities(panelNo);
			}
		},
		activityUrl(panel, activity) {
			let url = panel.url + '/view/' + activity.project_key + '-' + activity.key_id;
			if (activity.comment_id) {
				url += '#comment-' + activity.comment_id;
			}

			return url;
		},
		getStatusText(change) {
			let statusTypes = {
				status: '状態',
				assigner: '担当者',
				limitDate: '期限日',
				description: '説明文変更',
			};
			let statuses = {
				1: '未対応',
				2: '処理中',
				3: '処理済み',
				4: '完了',
			};

			if (! statusTypes[change.field]) return '';

			if (change.field === 'status') change.new_value = statuses[change.new_value];

			statusText = '[' + statusTypes[change.field] + ': ' + change.new_value + ']';

			return statusText;
		},
		escape(str) {
			if (! str) return;

			return str.replace(/[<>&"'`]/g, function(match) {
				var escape = {
					'<': '&lt;',
					'>': '&gt;',
					'&': '&amp;',
					'"': '&quot;',
					"'": '&#39;',
					'`': '&#x60;'
				};

				return escape[match];
			});
		}
	}
});
