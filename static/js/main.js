var gen_room_code = function () {
	return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5).toUpperCase();
};
var show_screen = function (screen_name) {
	$('.game_screen').css('display', 'none');
	$('#' + screen_name).css('display', 'block');
};
var lock_answer = function (socket) {
	$('#answer_input').prop('disabled', true);
	$('#lock_answer').prop('disabled', true);
	$('#lock_answer').val('LOCKED');
	socket.emit('answer_locked');
};
var reset_answer_locks = function () {
	$('#answer_input').prop('disabled', false);
	$('#lock_answer').prop('disabled', false);
	$('#lock_answer').val('Lock in Answer');
	$('#answer_input').val('');
};
// Main Split
var join_game_player = function (socket, username, room, guid) {
	$('#leave_game').css('display', 'block');
	socket.emit('join', {
		username: username,
		room: room,
		guid: guid
	});
	show_screen('player_game_screen');
	socket.on('unlock', function () {
		reset_answer_locks();
	});
	socket.on('lock', function () {
		lock_answer(socket);
	});
	var timeout = null;
	var post_current_answer = function () {
		socket.emit('answer_update', $('#answer_input').val());
	};
	$('#answer_input').on('keyup', function () {
		clearTimeout(timeout);
		timeout = setTimeout(post_current_answer, 300);
	});
};
var join_game_owner = function (socket, room_code) {
	var spotify_code = '';
	$('#leave_game').css('display', 'block');
	$('.pre_game').css('display', 'inline-block');
	$('#room_code').html(room_code);
	socket.emit('start_game', {
		gm_name: 'Cookie Masterson',
		room_code: room_code
	});
	$('#import_questions').on('click', function () {
		get_spotify_code();
		show_screen('question_input_screen');
	});
	$('#save_questions').on('click', function () {
		show_screen('gm_screen');
	});
	$('#lock_all_answers').on('click', function () {
		socket.emit('lock', {});
	});


  
	function GameViewModel() {
		socket.on('free_user', function (data, cb) {
			var player = self.players().filter(function (val) {
				return data.guid == val.guid;
			})[0];
			$("[guid='" + data.guid + "']").each(function (i, val) {
				$(val).attr('guid', 'dead_user-' + player.name);
			});
			$('#' + data.guid).attr('id', 'dead_user-' + player.name);
			self.questions().forEach(function (val) {
				val.player_answers.forEach(function (val2) {
					if (val2.player == player.guid) {
						val2.player = 'dead_user-' + player.name;
					}
				});
			});
			player.guid = '';
			save_state();
		});
		socket.on('push_answer', function (data, cb) {
			$('#' + data.guid).html(data.answer);
		});
		socket.on('answer_locked', function (data, cb) {
			$('.player_answer_lock[guid=' + data.guid + ']').css('display', 'block');
			$('.player_answer_lock[guid=' + data.guid + ']').on('click', function () {
				if (!self.questions()[self.current_question()].answer_shown) {
					socket.emit('unlock', { guid: data.guid });
					$('#' + data.guid).html('');
					$('[guid=' + data.guid + ']').css('display', 'none');
				}
			});
		});
		$('#show_answer').on('click', function () {
			$('#show_answer').prop('disabled', true);
			$('#lock_all_answers').prop('disabled', true);
			self.questions()[self.current_question()].answer_shown = true;
			socket.emit('lock', {});
			commit_answers();
			send_answer();
			if (self.questions().filter(function (val) {
					return !val.answer_shown;
				}).length == 0) {
				$('#finish_game').prop('disabled', false);
			}
		});
		$('#player_info_area').on('click', '.player_answer_points', function (event) {
			var node = $(event.target);
			if ($('#points-edit_' + node.prop('guid')).length == 0) {
				node.html("<input id='points-edit_" + node.prop('guid') + "' class='form-control' style='width:3em;' type='text' value='" + node.html() + "' />");
				$('#points-edit_' + node.prop('guid')).focus();
				$('#points-edit_' + node.prop('guid')).on('blur', function () {
					var number = parseInt($('#points-edit_' + node.prop('guid')).val().replace(/(\D)/g, ''));
					number = isNaN(number) ? 0 : number;
					self.questions()[self.current_question()].player_answers.filter(function (val) {
						return val.player == node.attr('guid');
					})[0].points = number;
					node.html(number);
					save_state();
				});
			}
		});
		$('#previous_question').on('click', function () {
			if (self.current_question() > 0) {
				self.current_question(self.current_question() - 1);
				send_question();
			}
			if (self.questions()[self.current_question()].answer_shown && !self.questions()[self.current_question()].round_header) {
				send_answer();
				$('.player_answer').each(function (i, val) {
					var pa = self.questions()[self.current_question()].player_answers.filter(function (val2) {
						return val2.player == $(val).prop('id');
					})[0];
					var answer = pa ? pa.answer : "[[Didn't Answer]]";
					$(val).html(answer);
				});
				socket.emit('lock', {});
			} else {
				$('.player_answer').each(function (i, val) {
					$(val).html('');
				});
				$('.player_answer_lock').each(function (i, val) {
					$(val).css('display', 'none');
				});
				socket.emit('unlock', {});
			}
			save_state();
		});
		$('#next_question').on('click', function () {
			if (self.current_question() < self.questions().length - 1) {
				self.current_question(self.current_question() + 1);
				send_question();
			}
			if (self.questions()[self.current_question()].answer_shown && !self.questions()[self.current_question()].round_header) {
				send_answer();
				$('.player_answer').each(function (i, val) {
					var pa = self.questions()[self.current_question()].player_answers.filter(function (val2) {
						return val2.player == $(val).prop('id');
					})[0];
					var answer = pa ? pa.answer : "[[Didn't Answer]]";
					$(val).html(answer);
				});
				socket.emit('lock', {});
			} else {
				$('.player_answer').each(function (i, val) {
					$(val).html('');
				});
				$('.player_answer_lock').each(function (i, val) {
					$(val).css('display', 'none');
				});
				socket.emit('unlock', {});
			}
			save_state();
		});
		$('#view_scores').on('click', function () {
			calculate_leaderboard();
			show_screen('leaderboard_screen');
		});
		$('#score_back').on('click', function () {
			send_question();
			if (self.questions()[self.current_question()].answer_shown && !self.questions()[self.current_question()].round_header) {
				send_answer();
			}
			show_screen('gm_screen');
		});
		$('#show_scores').on('click', function () {
			calculate_leaderboard();
			show_screen('leaderboard_screen');
			socket.emit('send_question', $('#score_table')[0].outerHTML);
		});
		$('#question_input_box').on('keyup', function () {
			clearTimeout(timeout);
			timeout = setTimeout(process_questions, 1000);
		});
	}
	;
	ko.applyBindings(new GameViewModel());
};
// Game Controls
$(document).ready(function () {
	socket.on('message', function (data, cb) {
		console.log(data);
	});
	socket.emit('get_session');
	socket.on('get_session', function (data, cb) {
		if (data.username == 'Cookie Masterson') {
			join_game_owner(socket, data.room);
		} else if (data.guid) {
			join_game_player(socket, data.username, data.room, data.guid);
		}
	});
	socket.on('receive_question', function (data, cb) {
		$('.question_here').each(function (i, val) {
			$(val).html(data);
		});
		$('.answer_here').each(function (i, val) {
			$(val).html('');
		});
	});
	socket.on('receive_answer', function (data, cb) {
		$('.answer_here').each(function (i, val) {
			$(val).html(data);
		});
	});
	$('#new_btn').on('click', function () {
		var room_code = gen_room_code();
		join_game_owner(socket, room_code);
		localStorage.clear();
	});
	$('#join_btn').on('click', function () {
		show_screen('player_connect_screen');
		localStorage.clear();
	});
	$('#join_game').on('click', function () {
		join_game_player(socket, $('#player_username').val(), $('#join_room_code').val().toUpperCase(), 'new');
	});
	$('#leave_game').on('click', function () {
		socket.emit('leave');
		$('#leave_game').css('display', 'none');
		$('.pre_game').css('display', 'none');
		$('.in_game').css('display', 'none');
		$('#finish_game').css('display', 'none');
		show_screen('start_screen');
		localStorage.clear();
	});
	$('#lock_answer').on('click', function () {
		lock_answer(socket);
	});
	$('.submit_on_enter').on('keypress', function (event) {
		if (event.keyCode == 13 || event.which == 13) {
			$('#join_game').click();
		}
	});
});