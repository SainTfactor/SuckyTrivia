var save_state = function (question_tree) {
    localStorage.setItem("questions", JSON.stringify(question_tree.questions));
    localStorage.setItem("players", JSON.stringify(question_tree.players));
    localStorage.setItem("current_question", JSON.stringify(question_tree.current_question));
    localStorage.setItem("leaderboard", JSON.stringify(question_tree.leaderboard));
}

var load_state = function (question_tree) {
  if(localStorage.getItem("questions")) {
    question_tree.questions = JSON.parse(localStorage.getItem("questions"));
  }
  if(localStorage.getItem("players")) {
    question_tree.players = JSON.parse(localStorage.getItem("players"));
  }
  if(localStorage.getItem("current_question")) {
    question_tree.current_question = JSON.parse(localStorage.getItem("current_question"));
    if (question_tree.current_question > 0) {
      $(document).ready(function() { start_game(); });
    }
  }
  if(localStorage.getItem("leaderboard")) {
    question_tree.leaderboard = JSON.parse(localStorage.getItem("leaderboard"));
  }
}

var send_question = function (question_tree) {
  if (question_tree.current_question != -1 && question_tree.current_question < question_tree.questions.length) {
      var current = question_tree.questions[question_tree.current_question];
      socket.emit('send_question', current.question + (current.points == "" ? "" : ' <small>(' + current.points + 'pts)</small>'));
  }
}

var socket = io.connect('http://trivia.saintfactorstudios.com/socket_space');

var calculate_leaderboard = function (question_tree) {
  var leaderboard = question_tree.players.map(function (val) {
      return { place: 0, player_name: val.name, guid: val.guid, score: 0 }
  });            
  leaderboard = leaderboard.map(function(val){  
      val.score = question_tree.questions
          .map(function(val2){ return val2.player_answers }).flat()
          .filter(function (val2) { return val2.player == val.guid })
          .reduce(function(acc, cur){ return acc + (cur.points == "" ? 0 : cur.points) }, 0);
      return val;
  }).sort(function(a,b){ return b.score - a.score; });
  leaderboard.map(function(val, i){ val.place = i+1; return val; });
  question_tree.leaderboard = leaderboard;
};

var send_answer = function (question_tree) {
  var answer = question_tree.questions[question_tree.current_question].answer;
  socket.emit('send_answer', "Answer" + (answer.indexOf("|") == -1 ? "" : "s") + ": " + answer.split("|").join(", "));
};

var commit_answers = function (question_tree) {
  var current = question_tree.questions[question_tree.current_question];
  current.players.forEach(function (i, val) {
    got_it = current.answer.split("|").map(function(val){ return val.replace(/(\W)/g, '').toLowerCase() }).includes($(val).html().replace(/(\W)/g, '').toLowerCase())
    current.player_answers.push({
      player: $(val).prop('id'),
      answer: $(val).html(),
      points: got_it ? current.points : 0
    });
  });
save_state();
};