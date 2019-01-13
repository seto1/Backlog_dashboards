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
			this.loadActivities();
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
		loadActivities() {
			// 取得する更新の種別
			let activityTypeIds = [
				1, // 課題の追加
				2, // 課題の更新
				3, // 課題にコメント
			];
			let activityUrlString = 'activityTypeId[]=' + activityTypeIds.join('&activityTypeId[]=');
			for (let i = 0; i < config.length; i++) {
				let url = config[i].url + '/api/v2/space/activities?count=10&apiKey=' + config[i].apiKey
					+ '&' + activityUrlString;
				axios.get(url).then(response => {
					this.convertActivityApiData(config[i], response);
					this.panels[i] = this.convertActivityApiData(config[i], response);
					this.panels = Object.assign({}, this.panels);
				});
			}
		},
		convertActivityApiData(spaceConfig, response) {
			let activityData = {
				name: spaceConfig.name,
				url: spaceConfig.url,
				activities: [],
			};

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

				switch (activity.type) {
					case 1:
						activity.type_text = '課題追加';
						break;
					case 2:
						activity.type_text = '課題更新';
						break;
					case 3:
						activity.type_text = 'コメント';
						break;
				}

				activity.description = response.data[i].content.description;
				if (response.data[i].content.description) {
					activity.description = this.escape(response.data[i].content.description);
					activity.description = activity.description.replace(/\n/g, '<br>');
				}

				activityData.activities.push(activity);
			}

			return activityData;
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
