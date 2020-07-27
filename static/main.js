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
    var spotify_code = "";
    $('#leave_game').css('display', 'block');
    $('.pre_game').css('display', 'inline-block');
    $('#room_code').html(room_code);
    socket.emit('start_game', {
        gm_name: 'Cookie Masterson',
        room_code: room_code
    });

    var get_spotify_code = function() {
        socket.emit("get_spotify_code")
        socket.on("spotify_code", function(data){
            spotify_code = data.data.access_token;
        });
    };
  
    show_screen('gm_screen');
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
        var self = this;
        self.questions = ko.observableArray([]);
        self.players = ko.observableArray([]);
        self.current_question = ko.observable(-1);
        self.leaderboard = ko.observableArray([]);

	var save_state = function () {
	    localStorage.setItem("questions", JSON.stringify(self.questions()));
            localStorage.setItem("players", JSON.stringify(self.players()));
            localStorage.setItem("current_question", JSON.stringify(self.current_question()));
            localStorage.setItem("leaderboard", JSON.stringify(self.leaderboard()));
        }
	var load_state = function () {
            if(localStorage.getItem("questions")) {
	      self.questions(JSON.parse(localStorage.getItem("questions")));
            }
            if(localStorage.getItem("players")) {
              self.players(JSON.parse(localStorage.getItem("players")));
            }
            if(localStorage.getItem("current_question")) {
              self.current_question(JSON.parse(localStorage.getItem("current_question")));
	      if (self.current_question() > 0) {
	        $(document).ready(function() { start_game(); });
	      }
            }
            if(localStorage.getItem("leaderboard")) {
              self.leaderboard(JSON.parse(localStorage.getItem("leaderboard")));
            }
        }
        load_state();

	var calculate_leaderboard = function () {
            var leaderboard = self.players().map(function (val) {
                return { place: 0, player_name: val.name, guid: val.guid, score: 0 }
            });            
            leaderboard = leaderboard.map(function(val){  
                val.score = self.questions()
                    .map(function(val2){ return val2.player_answers }).flat()
                    .filter(function (val2) { return val2.player == val.guid })
                    .reduce(function(acc, cur){ return acc + (cur.points == "" ? 0 : cur.points) }, 0);
                return val;
            }).sort(function(a,b){ return b.score - a.score; });
            leaderboard.map(function(val, i){ val.place = i+1; return val; });
            self.leaderboard(leaderboard);
        };
        var send_question = function () {
            $('.player_answer_points').each(function (i, val) {
                $(val).css('display', 'none');
            });
            if (self.current_question() != -1 && self.current_question() < self.questions().length) {
                var current = self.questions()[self.current_question()];
                socket.emit('send_question', current.question + (current.points == "" ? "" : ' <small>(' + current.points + 'pts)</small>'));
            }
        };
        var send_answer = function () {
            $('.player_answer_points').each(function (i, val) {
                pap = self.questions()[self.current_question()].player_answers.filter(function (val2) {
                    return val2.player == $(val).attr('guid');
                })[0];
                $(val).html(pap ? pap.points : 0);
                $(val).css('display', 'inline-block');
            });
            var answer = self.questions()[self.current_question()].answer;
            socket.emit('send_answer', "Answer" + (answer.indexOf("|") == -1 ? "" : "s") + ": " + answer.split("|").join(", "));
        };
        var commit_answers = function () {
            current = self.questions()[self.current_question()];
            $('.player_answer').each(function (i, val) {
                got_it = current.answer.split("|").map(function(val){ return val.replace(/(\W)/g, '').toLowerCase() }).includes($(val).html().replace(/(\W)/g, '').toLowerCase())
                current.player_answers.push({
                    player: $(val).prop('id'),
                    answer: $(val).html(),
                    points: got_it ? current.points : 0
                });
            });
	    save_state();
        };
        var timeout = null;
        var process_questions = function () {
            self.questions.removeAll();
            var raw_data = $('#question_input_box').val();
            var q_arry = raw_data.split('\n\n');
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
                    if (qst.indexOf("[[") != -1 && qst.indexOf("]]") != -1) {
		        qst = qst.replace("[[", "<img style='display:block;max-width:100%;max-height:20em;margin:auto;margin-top:10px;' src='").replace("]]", "' />");
                    }
		    if (qst.indexOf("{{") != -1 && qst.indexOf("}}") != -1) {
                        a_question.question = "Loading music..."
                        search_string = qst.substring(qst.indexOf("{{")+2, qst.indexOf("}}"));
                        fetch("https://api.spotify.com/v1/search?q=" + encodeURIComponent(search_string) + "&type=track&limit=1", { 
                            headers: { 
                                "Accept": "application/json", 
                                "Content-Type": "application/json", 
                                "Authorization": "Bearer " + spotify_code 
			    } 
			}).then(function(resp){
                            var update_target = index
                            if(resp.ok && resp.status == 200) {
                                resp.json().then(function(data){ 
                                    song = data.tracks.items[0];
                                    track = song.preview_url;
				    if(track){
			                qst = qst.replace(/{{.+}}/g, "<audio controls='' style='display:block;max-width:100%;margin:auto;margin-top:10px;'><source src='replace_me'></source></audio>").replace("replace_me", track);
                                        self.questions()[update_target].question = qst;
                                        $($(".preview_question")[update_target]).html(qst);
				    } else {
                                        $.get("/pull_url", { url: song.external_urls.spotify }, function(data){
                                            previews = data.match(/https:\/\/p\.scdn\.co[^'"]+/g);
                                            if(previews.length != 0) {
						track = previews[previews.length - 1]
			                        qst = qst.replace(/{{.+}}/g, "<audio controls='' style='display:block;max-width:100%;margin:auto;margin-top:10px;'><source src='replace_me'></source></audio>").replace("replace_me", track);
                                            } else {
				                qst = "!!Could not find " + search_string + "!!";
                                            }
                                            self.questions()[update_target].question = qst;
                                            $($(".preview_question")[update_target]).html(qst);
                                        }).fail(function(){
                                            qst = "Communications error while fetching " + search_string;
                                            self.questions()[update_target].question = qst;
                                            $($(".preview_question")[update_target]).html(qst);
					});
                                    }
                                });
                            } else {
                                qst = "Communications error while fetching " + search_string;
			    }
                            self.questions()[update_target].question = qst;
                            $($(".preview_question")[update_target]).html(qst);
                        });
                    } else {
		        a_question.question = qst;
		    }
                }
                if (a_question.question[0] == "[") {
                    a_question.question = "<span style='font-weight:900;'>" + a_question.question.substr(1, a_question.question.length -2) + "</span>";
                    a_question.answer = "";
                    a_question.points = "";
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
                self.questions.push(a_question);
            });
        };
        
        socket.on('player_join', function (data, cb) {
            if (!self.players().some(function (val) {
                    return data.name == val.name;
                })) {
                self.players.push(data);
            } else if (self.players().some(function (val) {
                        return data.name == val.name && val.guid == "";
                })) {
                self.players().filter(function (val) { return data.name == val.name && val.guid == ""; })[0].guid = data.guid;
                $("[guid='dead_user-" + data.name + "']").each(function(i, val){ $(val).attr("guid", data.guid) });
		$("[id='dead_user-" + data.name + "']").attr("id", data.guid);
                self.questions().forEach(function(val){
                    val.player_answers.forEach(function(val2) {
                        if (val2.player == ("dead_user-" + data.name)) {
                            val2.player = data.guid; 
                        }
                    });
                });
	    }
            if (self.current_question() != -1) {
                send_question();
                if (self.questions()[self.current_question()].answer_shown && !self.questions()[self.current_question()].round_header) {
                    send_answer();
                }
            }
	    save_state();
        });
        socket.on('free_user', function(data, cb) {
            var player = self.players().filter(function (val) { return data.guid == val.guid})[0];
	    $("[guid='" + data.guid + "']").each(function(i, val){ $(val).attr("guid", "dead_user-" + player.name) });
	    $("#" + data.guid).attr("id", "dead_user-" + player.name);
            self.questions().forEach(function(val){
                val.player_answers.forEach(function(val2) {
                    if (val2.player == player.guid) {
                        val2.player = "dead_user-" + player.name; 
                    }
                });
            });
	    player.guid = "";
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
    
        var start_game = function () {
            if (self.questions().length != 0) {
                $('.pre_game').css('display', 'none');
                $('.in_game').css('display', 'inline-block');
                $('#controls').css('display', 'block');
                show_screen('gm_screen');
                socket.emit('unlock', {});
                send_question();
            } else {
                alert("Can't start the game without questions, silly.");
            }
	    save_state();
        };
        $('#start_game').on('click', function() { 
	  self.current_question(0);
	  start_game(); 
	});

        $('#show_answer').on('click', function () {
            $('#show_answer').prop('disabled', true);
            $('#lock_all_answers').prop('disabled', true);
            self.questions()[self.current_question()].answer_shown = true;
            socket.emit('lock', {});
            commit_answers();
            send_answer();
            if(self.questions().filter(function(val){ return !val.answer_shown }).length == 0) {
                $("#finish_game").prop("disabled", false);
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
        $("#view_scores").on("click", function(){
            calculate_leaderboard();
            show_screen('leaderboard_screen');
        });
        $("#score_back").on("click", function(){
            send_question();
            if (self.questions()[self.current_question()].answer_shown && !self.questions()[self.current_question()].round_header) {
                send_answer();
            }
            show_screen('gm_screen');
        });
        $("#show_scores").on("click", function(){
            calculate_leaderboard();
            show_screen('leaderboard_screen');
            socket.emit('send_question', $("#score_table")[0].outerHTML);
        });
        $("#finish_game").on("click", function(){
            $('.pre_game').css('display', 'inline-block');
            $('.in_game').css('display', 'none');
            $('#controls').css('display', 'none');
            show_screen('gm_screen');
            socket.emit('send_question', "");
            self.current_question(-1);
            process_questions();
            $('.player_answer').each(function (i, val) {
                $(val).html('');
            });
            $('.player_answer_lock').each(function (i, val) {
                $(val).css('display', 'none');
            });
            socket.emit('unlock', {});
        });
        $('#question_input_box').on('keyup', function () {
            clearTimeout(timeout);
            timeout = setTimeout(process_questions, 1000);
        });
    };
    ko.applyBindings(new GameViewModel());
};
// Game Controls
$(document).ready(function () {
    var socket = io.connect('http://trivia.saintfactorstudios.ml/socket_space');
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
