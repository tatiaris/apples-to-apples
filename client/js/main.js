var socket = io();
var my_cards = [];
var my_info = {};
var all_players_info = {};

function is_empty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

$(document).on("click", ".self-card", function() {
    for (var i = 0; i < $('.self-card').length; i++) {
        $('.self-card').removeClass('chosen');
    }
    $(this).addClass('chosen');
});

$(document).on("click", "#btn-start-game", function() {
    socket.emit('start_game', {});
    $('#btn-start-game').html('Restart Game');
});

$(document).on("click", "#submit-card", function() {
    console.log('submitting card');
    var chosen_card_id = $('.chosen').attr('id');
    var chosen_card = {};
    for (var i = 0; i < my_cards.length; i++) {
        if (my_cards[i]['id'] == chosen_card_id) {
            chosen_card = my_cards[i];
            my_cards.splice(i, 1);
        }
    }
    if (!is_empty(chosen_card)){
        socket.emit('card_submission', {
            player: my_info,
            card: chosen_card
        });
    }
});

$(document).on("click", "#submit-winning-card", function() {
    console.log('submitting winning card');
    var chosen_card_id = $('.winning').attr('id');

    socket.emit('winning_card_submission', {
        card_id: chosen_card_id
    });
    toggle_judge_powers(false);
});

$(document).on("click", ".submission-card", function() {
    if (is_judge()) {
        console.log('winning card chosen');
        for (var i = 0; i < $('.submission-card').length; i++) {
            $('.submission-card').removeClass('winning');
        }
        $(this).addClass('winning');
    }
});

$(document).on("click", "#edit-name-btn", function() {
    // my_info.name = new_name;
    broadcast_name(prompt("Name:", ""));
});

function broadcast_name(name) {
    $('#self-player-name').html('Name: ' + name);
    socket.emit('name_update', {
        new_name: name
    });
}

function update_self_answers(ans_list) {
    var inner_html = ``;
    my_cards = ans_list;
    for (var i = 0; i < ans_list.length; i++) {
        inner_html += `<button id="` + ans_list[i]['id'] + `" class="card self-card" type="button" name="button">` + ans_list[i]['ans'] + `</button>`;
    }
    $('#my-cards').html(inner_html);
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

function display_judge_cards(card_list) {
    console.log('displaying submissions');
    card_list = shuffleArray(card_list);
    var inner_html = `<button id="prompt-card" class="card prompt-card" type="button" name="button">` + $('#prompt-card').html() + `</button>`;
    for (var i = 0; i < card_list.length; i++) {
        if (card_list[i].length == 1) {
            inner_html += `<button id="` + card_list[i][0]['id'] + `" class="card submission-card" type="button" name="button">` + card_list[i][0]['ans'] + `</button>`;
        } else {
            inner_html += `<button id="` + card_list[i][0]['id'] + `" class="card submission-card" type="button" name="button">` + card_list[i][0]['ans'] + '<br>.<br>.<br>.<br>' + card_list[i][1]['ans'] + `</button>`;
        }
    }
    $('#judge-cards').html(inner_html);
}

function activate_start_game_btn() {
    var btn_html = '<button id="btn-start-game" type="button" name="button">Start Game</button>';
    $('#my-btns').html($('#my-btns').html() + btn_html);
}

function display_leaderboard_data(players) {
    var inner_html = ``;
    var ids = Object.keys(players);
    for (var i = 0; i < ids.length; i++) {
        if (ids[i].judge) {update_czar(ids[i]);}
        inner_html += `<div class="player-data flex-center">
        <span class="cell">` + players[ids[i]].name + `</span>
        <span class="cell">` + players[ids[i]].points + `</span>
        </div>`;
    }
    $('#leaderboard-container').html(inner_html);
}

function toggle_choosing_cards(bool) {
    $('.self-card').prop('disabled', !bool);
    $('#submit-card').prop('disabled', !bool);
}

function toggle_winner_button(bool) {
    $('#submit-winning-card').prop('disabled', !bool);
}

function activate_admin_priviledges() {
    activate_start_game_btn();
}

function display_current_prompt(prompt) {
    $('#prompt-card').html(prompt.ans);
}

function update_czar(player_id) {
    $('#judge-player-name').html(all_players_info[player_id].name)
}

function request_prompt_info() {
    socket.emit('requesting_prompt_info', {});
}

function add_blank_card() {
    var inner_html = '<button class="card blank-card" type="button" name="button"></button>';
    $('#judge-cards').html($('#judge-cards').html() + inner_html);
}

function is_judge() {
    if (all_players_info[my_info.id].judge) return true;
    return false;
}

function add_log(str) {
    $('#log-container').html($('#log-container').html() + str + '<br>');
    update_scroll();
}

function toggle_judge_powers(bool) {
    $('#submit-winning-card').prop('disabled', !bool);
}

function display_winning_card(card_id) {
    var id = '#' + card_id.toString();
    $(id).addClass('winning');
}

function remove_submssion_cards() {
    $('#judge-cards').html('<button id="prompt-card" class="card prompt-card" type="button" name="button"></button>');
}

function update_scroll(){
    var element = document.getElementById("log-container");
    element.scrollTop = element.scrollHeight;
}

function add_new_answer() {
    socket.emit('new_answer', {
        answer: $('#new-answer').val()
    });
    $('#new-answer').val('');
}

function add_new_prompt() {
    socket.emit('new_prompt', {
        prompt: $('#new-prompt').val()
    });
    $('#new-prompt').val('');
}

socket.on('remove_submissions', function(data) {
    remove_submssion_cards();
});

socket.on('new_admin', function(data) {
    if (my_info['id'] == data.admin_id) {
        activate_admin_priviledges();
    }
});

socket.on('new_player_data', function(data) {
    my_info = data;
    $('#self-player-name').html('Name: ' + data.name);
    update_self_answers(data.hand);
    if (data.admin) {
        activate_admin_priviledges();
    }
    if (data.game_status == 'not_started') {
        toggle_choosing_cards(false);
    } else if (data.game_status == 'judging_ongoing') {
        toggle_choosing_cards(false);
        request_prompt_info();
    } else {
        request_prompt_info();
    }
});

socket.on('add_public_log', function(data) {
    add_log(data.log);
});

socket.on('receive_new_card', function(data) {
    my_cards.push(data.card);
    update_self_answers(my_cards);
});

socket.on('all_players_data', function(data) {
    all_players_info = data.players;
    display_leaderboard_data(data.players);
});

socket.on('submissions_complete', function(data) {
    toggle_choosing_cards(false);
});

socket.on('judge_question_info', function(data) {
    if (my_info['id'] == data.id) {
        toggle_choosing_cards(false);
    } else {
        toggle_choosing_cards(true);
        toggle_winner_button(false);
    }
    display_current_prompt(data.prompt);
    update_czar(data.id);
});

socket.on('new_submission', function(data) {
    add_blank_card();
});

socket.on('starting_judgement_phase', function(data) {
    toggle_judge_powers(is_judge());
    display_judge_cards(data.submissions);
});

socket.on('winning_card_declaration', function(data) {
    display_winning_card(data.card_id);
});
