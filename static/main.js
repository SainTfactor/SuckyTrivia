gen_room_code = function() {
	return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5).toUpperCase();
}

show_screen = function(screen_name) {
    $(".game_screen").css("display", "none");
    $("#" + screen_name).css("display", "block");
}

lock_answer = function(socket) {
   $("#answer_input").prop("disabled", true);
   $("#lock_answer").prop("disabled", true);
   $("#lock_answer").val("LOCKED");
   socket.emit("answer_locked");
}
reset_answer_locks = function() {
   $("#answer_input").prop("disabled", false);
   $("#lock_answer").prop("disabled", false);
   $("#lock_answer").val("Lock in Answer");
   $("#answer_input").val("");
}

// Main Split
join_game_player = function(socket, username, room, guid) { 
    $("#leave_game").css("display", "block");   
    socket.emit('join', {username: username, room: room, guid: guid});
    show_screen("player_game_screen");
    
    socket.on("unlock", function() {
        reset_answer_locks();
    });
    
    socket.on("lock", function() {
        lock_answer(socket);
    });
    
    timeout = null;
    post_current_answer = function() {
        socket.emit('answer_update', $("#answer_input").val())  
    }
    $("#answer_input").on("keyup", function() {
        clearTimeout(timeout);
        timeout = setTimeout(post_current_answer, 300);
    });
}

join_game_owner = function(socket, room_code) {
    $("#leave_game").css("display", "block");
    $("#import_questions").css("display", "inline-block");
    $("#start_game").css("display", "inline-block");
    
    $("#room_code").html(room_code);
    socket.emit('start_game', { gm_name: "Cookie Masterson", room_code: room_code});
    show_screen("gm_screen");
     
    socket.on("answer_locked", function(data, cb) {
        $("[guid=" + data.guid + "]").css("display", "block");
        $("[guid=" + data.guid + "]").on("click", function(){
            socket.emit("unlock", { guid: data.guid })
            $("#" + data.guid).html("")
            $("[guid=" + data.guid + "]").css("display", "none");
        })
    });   
    
    $("#import_questions").on("click", function() {
        show_screen("question_input_screen");
    });
    $("#save_questions").on("click", function() {
        show_screen("gm_screen");
    });
     
    $("#lock_all_answers").on("click", function() {
        socket.emit("lock", {})
    });
     
    function GameViewModel() {
        var self = this;

        self.players = ko.observableArray([]);
        self.current_question = -1;

        socket.on("player_join", function(data, cb){
            if(!self.players().some(function(val) { return data.name == val.name; })){
                self.players.push(data);
            }
        });
        
        send_question = function() {
            if (self.current_question != -1 && self.current_question < self.questions().length) {
                socket.emit("send_question", self.questions()[self.current_question].question)
            }
        }
        send_answer = function() {
            socket.emit("send_answer", self.questions()[self.current_question].answer)
        }
        
        $("#start_game").on("click", function(){
            if (self.questions().length != 0) {
                $("#import_questions").css("display", "none");
                $("#start_game").css("display", "none");
                $(".controls").css("display", "block");
                self.current_question = 0;
                send_question();
            } else {
                alert("Can't start the game without questions, silly.")
            }
        });
        
        $("#show_answer").on("click", function(){
            send_answer();
        });
        
        self.questions = ko.observableArray([]);
        timeout = null;
        process_questions = function() {
            self.questions.removeAll()
            raw_data = $("#question_input_box").val()
            q_arry = raw_data.split("\n\n")
            q_arry.forEach(function(val){
                part_arry = val.split("\n")
                a_question = { question: "<Missing Question>", answer: "<Missing Answer>", points: 0 }
                if (part_arry[0] != undefined) {
                    a_question.question = part_arry[0]
                }
                if (part_arry[1] != undefined) {
                    a_question.answer = part_arry[1]
                }
                if (part_arry[2] != undefined) {
                    a_question.points = parseInt(part_arry[2].replace(/\D/g,''))
                }
                self.questions.push(a_question)
            });
        }
        $("#question_input_box").on("keyup", function() {
            clearTimeout(timeout);
            timeout = setTimeout(process_questions, 300);
        });

        socket.on("push_answer", function(data, cb) {
            $("#" + data.guid).html(data.answer)
        });
    }
    ko.applyBindings(new GameViewModel());

}

// Game Controls
$(document).ready(function() {
    var socket = io.connect('http://trivia.saintfactorstudios.ml/socket_space');

    socket.on('message', function(data, cb) {
        console.log(data);
    });
    
    socket.emit('get_session')
    socket.on('get_session', function(data, cb) {
        if (data.username == "Cookie Masterson") {
            join_game_owner(socket, data.room)
        } else if (data.guid) { 
            join_game_player(socket, data.username, data.room, data.guid)
        }
    });
    
    socket.on("receive_question", function(data, cb) {
        $(".question_here").forEach(function(val){ $(val).html(data); });
        $(".answer_here").forEach(function(val){ $(val).html(""); });
    });
    socket.on("receive_answer", function(data, cb) {
        $(".answer_here").forEach(function(val){ $(val).html(data); });
    });

    $("#new_btn").on("click", function(){
        room_code = gen_room_code();
        join_game_owner(socket, room_code)
    });

    $("#join_btn").on("click", function(){
        show_screen("player_connect_screen");
    });

    $('#join_game').on("click", function() {
        join_game_player(socket, $("#player_username").val(), $("#join_room_code").val().toUpperCase(), "new")
    });

    $('#leave_game').on("click", function() {
        socket.emit("leave")
        $("#leave_game").css("display", "none");
        $("#import_questions").css("display", "none");
        $("#start_game").css("display", "none");
        show_screen("start_screen")
    });
    
    $("#lock_answer").on("click", function(){
        lock_answer(socket);
    });
    
    $(".submit_on_enter").on("keypress", function(event) {
        if (event.keyCode == 13 || event.which == 13) {
            $('#join_game').click();
        }
    });
});
