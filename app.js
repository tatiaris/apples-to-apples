const express = require('express');
const app = express();
const serv = require('http').Server(app);
const io = require('socket.io')(serv, {});

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);

var fs = require('fs');

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function map_list(arr) {
    var new_arr = [];
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] != '') {
            new_arr.push({id: i, ans: arr[i]});
        }
    }
    return new_arr;
}

function load_files() {
    try {
        var questions_txt = fs.readFileSync('./db/questions.txt', 'utf8') + fs.readFileSync('./db/custom_questions.txt', 'utf8');
        var answers_txt = fs.readFileSync('./db/answers.txt', 'utf8') + fs.readFileSync('./db/custom_answers.txt', 'utf8');
        questions_list = map_list(shuffleArray(questions_txt.split('\n')));
        answers_list = map_list(shuffleArray(answers_txt.split('\n')));
    } catch(e) {
        console.log('Error:', e.stack);
    }
}

var questions_list = [];
var answers_list = [];
var used_cards = [];

function generate_name(n) {
    return 'player_' + n.toString();
}

function get_random_card() {
    return answers_list.pop();
}

function get_random_question() {
    return questions_list.pop();
}

function generate_hand(n) {
    var ans = [];
    for (var i = 0; i < n; i++) {
        ans.push(get_random_card());
    }
    return ans;
}

var all_time_players = 0;
var player_list = {};
var active_players = {};
var inactive_players = [];
var game_info = {
    admin: '',
    status: 'not_started',
    judge_id: -1,
    prompt_info: '',
    submission_count: 0,
    round_submissions: {}
};

io.sockets.on('connection', function(socket) {
    all_time_players++;
    var id = all_time_players;
    var p_role = false;
    if (Object.keys(active_players).length == 0) {
        load_files();
        p_role = true;
    }

    var player = {
        admin: p_role,
        judge: false,
        name: generate_name(id),
        cards: generate_hand(8),
        points: 0,
        my_submissions: 0
    }
    active_players[id] = player;

    public_log('<span style="color:var(--winner);">' + player.name + ' joined the game</span>')

    socket.emit('new_player_data', {
        id: id,
        admin: player.admin,
        name: player.name,
        hand: player.cards,
        game_status: game_info['status']
    });

    function assign_new_card() {
        var rand_card = get_random_card();
        socket.emit('receive_new_card', {
            card: rand_card
        });
    }

    function forbid_more_submissions() {
        socket.emit('submissions_complete', {});
    }

    socket.on('card_submission', function(data) {
        active_players[id].my_submissions++;
        if (active_players[id].my_submissions > get_required_submissions()) {
        } else if (active_players[id].my_submissions == get_required_submissions()) {
            add_round_submission(data);
            game_info.submission_count++;
            assign_new_card();
            add_blank_public_card();
            forbid_more_submissions();
        } else {
            add_round_submission(data);
            game_info.submission_count++;
            assign_new_card();
            add_blank_public_card();
        }
        if (game_info.submission_count >= get_total_required_submissions()) {
            start_judgement_phase();
        }
    });

    socket.on('disconnect', function(data) {
        public_log('<span style="color:red;">' + player.name + ' disconnected</span>');
        remove_player(id);
    });

    socket.on('start_game', function(data) {
        if (Object.keys(active_players).length > 2) {
            public_log('starting game...');
            assign_judge_question();
            change_game_status('playing');
        }
    });

    socket.on('name_update', function(data) {
        public_log(active_players[id].name + ' changed their name to ' + data.new_name);
        player.name = data.new_name;
        active_players[id].name = data.new_name;
        update_all_players_data();
    });

    socket.on('requesting_prompt_info', function(data) {
        broadcast_judge_question();
    });

    socket.on('winning_card_submission', function(data) {
        announce_winning_card(data.card_id);
        announce_winner(data.card_id);
        setTimeout(start_new_round, 5000);
    });

    socket.on('new_answer', function(data) {
        add_new_answer(data.answer);
    });

    socket.on('new_prompt', function(data) {
        add_new_prompt(data.prompt);
    });

    update_all_players_data();
});

function restart() {

}

function is_valid(prompt) {
    if (prompt == '') return false;
    var single_count = (prompt.match(/_/g) || []).length;
    var triple_count = (prompt.match(/ ___ /g) || []).length;
    if (single_count == triple_count*3 || single_count == 0) return true;
    return false;
}

function add_new_answer(answer) {
    if (answer != '') {
        fs.appendFile('./db/custom_answers.txt', answer + '\n', function (err) {
            if (err) throw err;
            console.log('added new answer to file');
        });
    }
}

function add_new_prompt(prompt) {
    if (is_valid(prompt)) {
        prompt = prompt.replace('___', '_______');
        fs.appendFile('./db/custom_questions.txt', prompt + '\n', function (err) {
            if (err) throw err;
            console.log('added new question to file');
        });
    }
}

function announce_winner(card_id) {
    var winner_id = -1;
    var player_ids = Object.keys(game_info.round_submissions);
    for (var i = 0; i < player_ids.length; i++) {
        if (game_info.round_submissions[player_ids[i]].cards[0].id == card_id) {
            winner_id = player_ids[i];
        }
    }
    add_score(winner_id);
    broadcast_winner(winner_id);
}

function broadcast_winner(id) {
    public_log('<span class="color: var(--winner)">' + active_players[id].name + ' wins the round');
}

function add_score(id) {
    active_players[id].points++;
    update_all_players_data();
}

function remove_submission_counts() {
    var ids = Object.keys(active_players);
    for (var i = 0; i < ids.length; i++) {
        active_players[ids[i]].my_submissions = 0;
    }
}

function start_new_round() {
    game_info.submission_count = 0;
    game_info.round_submissions = {};
    remove_previous_cards();
    assign_judge_question();
    remove_submission_counts();
}

function remove_previous_cards() {
    io.sockets.emit('remove_submissions', {});
}

function announce_winning_card(id) {
    io.sockets.emit('winning_card_declaration', {
        card_id: id
    });
}

function add_round_submission(data) {
    if (data.player.id.toString() in game_info.round_submissions) {
        game_info.round_submissions[data.player.id].cards.push(data.card);
    } else {
        game_info.round_submissions[data.player.id] = {cards: [data.card]};
    }
}

function get_submitted_cards() {
    var cards = [];
    var id_list = Object.keys(game_info.round_submissions);
    for (var i = 0; i < id_list.length; i++) {
        cards.push(game_info.round_submissions[id_list[i]].cards);
    }
    return cards;
}

function start_judgement_phase() {
    public_log('starting judgement phase');
    game_info.status = 'judgement_phase';
    io.sockets.emit('starting_judgement_phase', {
        submissions: shuffleArray(get_submitted_cards())
    });
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function get_total_required_submissions() {
    return get_required_submissions()*(Object.keys(active_players).length - 1);
}

function get_required_submissions() {
    var temp = game_info.prompt_info.ans;
    var count = (temp.match(/_______/g) || []).length;
    if (count == 0) count = 1;
    return count;
}

function add_blank_public_card() {
    io.sockets.emit('new_submission', {});
}

function remove_admin(id) {
    inactive_players[id].admin = false;
}

function add_new_admin() {
    if (Object.keys(active_players).length > 0) {
        active_players[Object.keys(active_players)[0]].admin = true;
        broadcast_new_admin(Object.keys(active_players)[0]);
    }
    update_all_players_data();
}

function broadcast_new_admin(id) {
    io.sockets.emit('new_admin', {
        admin_id: id
    });
}

function broadcast_judge_question() {
    io.sockets.emit('judge_question_info', {
        id: game_info.judge_id,
        prompt: game_info.prompt_info
    });
}

function get_next_id(cur_id) {
    var all_ids = Object.keys(active_players);
    if (all_ids.indexOf(cur_id) == all_ids.length - 1) {
        return all_ids[0];
    }
    return all_ids[all_ids.indexOf(cur_id) + 1];
}

function assign_judge_question() {
    var new_judge_id;
    if (game_info.judge_id == -1) {
        new_judge_id = assign_judge();
    } else {
        active_players[game_info.judge_id].judge = false;
        new_judge_id = get_next_id(game_info.judge_id);
    }
    var question = get_random_question();
    game_info.judge_id = new_judge_id;
    game_info.prompt_info = question;
    active_players[new_judge_id].judge = true;
    public_log('<span style="color:var(--czar);">' + active_players[new_judge_id].name + ' is the new Czar</span>')
    broadcast_judge_question();
    update_all_players_data();
}

function remove_player(id) {
    var temp_player = active_players[id];
    delete active_players[id];
    inactive_players[id] = temp_player;
    if (inactive_players[id].admin) {
        remove_admin(id);
        add_new_admin();
    }
    if (inactive_players[id].judge) {
        game_info.judge_id = -1;
        start_new_round();
    }
    update_all_players_data();
}

function assign_judge() {
    var rand = Math.floor(Math.random() * Object.keys(active_players).length);
    active_players[Object.keys(active_players)[rand]].judge = true;
    return Object.keys(active_players)[rand];
}

function change_game_status(status) {
    game_info['status'] = status;
}

function update_all_players_data(){
    io.sockets.emit('all_players_data', {
        players: active_players
    });
}

function public_log(str) {
    io.sockets.emit('add_public_log', {
        log: str
    });
}
