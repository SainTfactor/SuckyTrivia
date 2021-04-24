var input_questions = {
	props: ['question_tree'],
	data: function () {
		return {
			timeout: null,
			questions_raw: '',
			spotify_code: ''
		};
	},
	methods: {
		queue_process_questions: function () {
			var self = this;
			clearTimeout(self.timeout);
			self.timeout = setTimeout(self.process_questions, 1000);
		},
		get_spotify_code: function () {
			var self = this;
			socket.emit('get_spotify_code');
			socket.on('spotify_code', function (data) {
				self.spotify_code = data.data.access_token;
			});
		},
		process_questions: function () {
			var self = this;
			self.question_tree.questions.removeAll();
			var q_arry = self.questions_raw.split('\n\n');
			q_arry.forEach(function (val, index) {
				var part_arry = val.split('\n');
				var a_question = {
					question: '<Missing Question>',
					answer: '<Missing Answer>',
					points: 0,
					answer_shown: false,
					round_header: false,
					player_answers: []
				};
				if (part_arry[0] != undefined) {
					var qst = part_arry[0];
					if (qst.indexOf('[[') != -1 && qst.indexOf(']]') != -1) {
						qst = qst.replace('[[', "<img style='display:block;max-width:100%;max-height:20em;margin:auto;margin-top:10px;' src='").replace(']]', "' />");
					}
					if (qst.indexOf('{{') != -1 && qst.indexOf('}}') != -1) {
						a_question.question = 'Loading music...';
						search_string = qst.substring(qst.indexOf('{{') + 2, qst.indexOf('}}'));
						fetch('https://api.spotify.com/v1/search?q=' + encodeURIComponent(search_string) + '&type=track&limit=1', {
							headers: {
								'Accept': 'application/json',
								'Content-Type': 'application/json',
								'Authorization': 'Bearer ' + spotify_code
							}
						}).then(function (resp) {
							var update_target = index;
							if (resp.ok && resp.status == 200) {
								resp.json().then(function (data) {
									song = data.tracks.items[0];
									track = song.preview_url;
									if (track) {
										qst = qst.replace(/{{.+}}/g, "<audio controls='' style='display:block;max-width:100%;margin:auto;margin-top:10px;'><source src='replace_me'></source></audio>").replace('replace_me', track);
										self.question_tree.questions[update_target].question = qst;
										$($('.preview_question')[update_target]).html(qst);
									} else {
										$.get('/pull_url', { url: song.external_urls.spotify }, function (data) {
											previews = data.match(/https:\/\/p\.scdn\.co[^'"]+/g);
											if (previews.length != 0) {
												track = previews[previews.length - 1];
												qst = qst.replace(/{{.+}}/g, "<audio controls='' style='display:block;max-width:100%;margin:auto;margin-top:10px;'><source src='replace_me'></source></audio>").replace('replace_me', track);
											} else {
												qst = '!!Could not find ' + search_string + '!!';
											}
											self.question_tree.questions[update_target].question = qst;
											$($('.preview_question')[update_target]).html(qst);
										}).fail(function () {
											qst = 'Communications error while fetching ' + search_string;
											self.question_tree.questions[update_target].question = qst;
											$($('.preview_question')[update_target]).html(qst);
										});
									}
								});
							} else {
								qst = 'Communications error while fetching ' + search_string;
							}
							self.question_tree.questions[update_target].question = qst;
							$($('.preview_question')[update_target]).html(qst);
						});
					} else {
						a_question.question = qst;
					}
				}
				if (a_question.question[0] == '[') {
					a_question.question = "<span style='font-weight:900;'>" + a_question.question.substr(1, a_question.question.length - 2) + '</span>';
					a_question.answer = '';
					a_question.points = '';
					a_question.answer_shown = true;
					a_question.round_header = true;
				} else {
					if (part_arry[1] != undefined) {
						a_question.answer = part_arry[1];
					}
					if (part_arry[2] != undefined) {
						a_question.points = parseInt(part_arry[2].replace(/\D/g, ''));
					}
				}
				self.question_tree.questions.push(a_question);
			});
		}
	},
	mounted: function () {
		console.log('mount 3');
	}
};