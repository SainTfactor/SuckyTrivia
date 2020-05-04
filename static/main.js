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
    $('#leave_game').css('display', 'block');
    $('.pre_game').css('display', 'inline-block');
    $('#room_code').html(room_code);
    socket.emit('start_game', {
        gm_name: 'Cookie Masterson',
        room_code: room_code
    });
    show_screen('gm_screen');
    
    socket.on('answer_locked', function (data, cb) {
        $('.player_answer_lock[guid=' + data.guid + ']').css('display', 'block');
        $('.player_answer_lock[guid=' + data.guid + ']').on('click', function () {
            socket.emit('unlock', { guid: data.guid });
            $('#' + data.guid).html('');
            $('[guid=' + data.guid + ']').css('display', 'none');
        });
    });
    
    $('#import_questions').on('click', function () {
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
        
        var calculate_leaderboard = function () {
            var leaderboard = self.players().map(function (val) {
                return { place: 0, player_name: val.name, guid: val.guid, score: 0 }
            });            
            leaderboard.map(function(val){  
                val.score = self.questions()
                    .map(function(val2){ return val2.player_answers }).flat()
                    .filter(function (val2) { return val2.player == val.guid })
                    .reduce(function(acc, cur){ return acc + (cur.points == "" ? 0 : cur.points) }, 0);
                return val;
            }).sort(function(a,b){ return a.score - b.score; });
            console.log(leaderboard);
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
        };
        var timeout = null;
        var process_questions = function () {
            self.questions.removeAll();
            var raw_data = $('#question_input_box').val();
            var q_arry = raw_data.split('\n\n');
            q_arry.forEach(function (val) {
                var part_arry = val.split('\n');
                var a_question = {
                    question: '<Missing Question>',
                    answer: '<Missing Answer>',
                    points: 0,
                    answer_shown: false,
                    player_answers: []
                };
                if (part_arry[0] != undefined) {
                    a_question.question = part_arry[0];
                }
                if (a_question.question[0] == "[") {
                    a_question.question = a_question.question.substr(1, a_question.question.length -2);
                    a_question.answer = "";
                    a_question.points = "";
                    a_question.answer_shown = true;
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
            }
            if (self.current_question() != -1) {
                send_question();
                if (self.questions()[self.current_question()].answer_shown) {
                    send_answer();
                }
            }
        });
        socket.on('push_answer', function (data, cb) {
            $('#' + data.guid).html(data.answer);
        });
        
        $('#start_game').on('click', function () {
            if (self.questions().length != 0) {
                $('.pre_game').css('display', 'none');
                $('.in_game').css('display', 'inline-block');
                $('#controls').css('display', 'block');
                self.current_question(0);
                show_screen('gm_screen');
                socket.emit('unlock', {});
                send_question();
            } else {
                alert("Can't start the game without questions, silly.");
            }
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
                    self.questions()[self.current_question()].player_answers.filter(function (val) {
                        return val.player == node.attr('guid');
                    })[0].points = number;
                    node.html(number);
                });
            }
        });
        $('#previous_question').on('click', function () {
            if (self.current_question() > 0) {
                self.current_question(self.current_question() - 1);
                send_question();
            }
            if (self.questions()[self.current_question()].answer_shown) {
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
        });
        $('#next_question').on('click', function () {
            if (self.current_question() < self.questions().length - 1) {
                self.current_question(self.current_question() + 1);
                send_question();
            }
            if (self.questions()[self.current_question()].answer_shown) {
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
        });
        $("#view_scores").on("click", function(){
            calculate_leaderboard();
            show_screen('leaderboard_screen');
        });
        $("#score_back").on("click", function(){
            send_question();
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
            socket.emit('unlock', {});
            self.current_question(-1);
            process_questions();
        });
        $('#question_input_box').on('keyup', function () {
            clearTimeout(timeout);
            timeout = setTimeout(process_questions, 300);
        });
    }
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
    });
    $('#join_btn').on('click', function () {
        show_screen('player_connect_screen');
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