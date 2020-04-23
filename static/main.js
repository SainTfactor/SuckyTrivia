gen_room_code = function() {
	return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5).toUpperCase();
}

show_screen = function(screen_name) {
    $(".game_screen").css("display", "none");
    $("#" + screen_name).css("display", "block");
}

lock_answer = function() {
   $("#answer_input").prop("disabled", true);
   $("#lock_answer").prop("disabled", true);
   socket.emit("answer_locked");
}
reset_answer_locks = function() {
   $("#answer_input").prop("disabled", false);
   $("#lock_answer").prop("disabled", false);
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
    $("#room_code").html(room_code);
    socket.emit('start_game', { gm_name: "Cookie Masterson", room_code: room_code});
    show_screen("gm_screen");
     
    socket.on("answer_locked", function(data, cb) {
        $("[guid=" + data.guid + "]").css("display", "block");
        $("[guid=" + data.guid + "]").on("click", function(){
            socket.emit("unlock", { guid: data.guid })
        })
    });   
     
    function GameViewModel() {
        var self = this;

        self.players = ko.observableArray([]);

        socket.on("player_join", function(data, cb){
            if(!self.players().some(function(val) { return data.name == val.name; })){
                self.players.push(data);
            }
        });

        socket.on("push_answer", function(data, cb) {
            console.log("data caught")
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
        console.log(data);
        if (data.username == "Cookie Masterson") {
            join_game_owner(socket, data.room)
        } else if (data.guid) { 
            join_game_player(socket, data.username, data.room, data.guid)
        }
    });

    $("#new_btn").on("click", function(){
        room_code = gen_room_code();
        join_game_owner(socket, room_code)
    });

    $("#join_btn").on("click", function(){
        show_screen("player_connect_screen");
    });

    $('#join_game').on("click", function() {
        console.log("Sending join request")
        join_game_player(socket, $("#player_username").val(), $("#join_room_code").val().toUpperCase(), "new")
    });

    $('#leave_game').on("click", function() {
        socket.emit("leave")
        $("#leave_game").css("display", "none");
        show_screen("start_screen")
    });
    
    $("#lock_answer").on("click", function(){
        lock_answer();
    });
});
