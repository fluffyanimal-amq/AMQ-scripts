// ==UserScript==
// @name         AMQ Song History (with localStorage)
// @namespace    https://github.com/fluffyanimal-amq
// @version      1.0
// @description  Display Song history in the song info box, including the guess rate and time since last time the song played.
// @author       fluffyanimal (cloned from Minigamer42)
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/Minigamer42/scripts/raw/master/lib/commands.js
// @downloadURL  https://github.com/fluffyanimal-amq/AMQ-scripts/raw/main/amqSongHistoryLocalstorage.user.js
// @updateURL    https://github.com/fluffyanimal-amq/AMQ-scripts/raw/main/amqSongHistoryLocalstorage.user.js
// ==/UserScript==

const infoDiv = document.createElement('div');
infoDiv.className = "rowPlayCount";

if (window.quiz) {
    setup();
}

function setup() {
    function timeAgo(time) {
        if (time === 0) {
            return 'never';
        }
        switch (typeof time) {
            case 'number':
                break;
            case 'string':
                time = +new Date(time);
                break;
            case 'object':
                if (time.constructor === Date) time = time.getTime();
                break;
            default:
                time = +new Date();
        }
        const time_formats = [
            [60, 'seconds', 1], // 60
            [120, '1 minute ago', '1 minute from now'], // 60*2
            [3600, 'minutes', 60], // 60*60, 60
            [7200, '1 hour ago', '1 hour from now'], // 60*60*2
            [86400, 'hours', 3600], // 60*60*24, 60*60
            [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
            [604800, 'days', 86400], // 60*60*24*7, 60*60*24
            [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
            [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
            [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
            [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
            [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
            [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
            [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
            [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
        ];
        let seconds = (+new Date() - time) / 1000,
            token = 'ago',
            list_choice = 1;

        if (seconds === 0) {
            return 'Just now';
        }
        if (seconds < 0) {
            seconds = Math.abs(seconds);
            token = 'from now';
            list_choice = 2;
        }
        let i = 0, format;
        while (format = time_formats[i++]) {
            if (seconds < format[0]) {
                if (typeof format[2] == 'string') {
                    return format[list_choice];
                } else {
                    return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
                }
            }
        }
        return time;
    }

    let boxDiv = document.querySelector('div.qpSideContainer > div.row').parentElement;
    boxDiv.insertBefore(infoDiv, boxDiv.children[4]);

    if (!localStorage.getItem('songHistory')) {
        localStorage.setItem('songHistory', '{}');
    }
    const l = new Listener("answer results");
    l.callback = async (data) => {
        const webm = data.songInfo.videoTargetMap?.catbox?.[720]?.slice(0, 6) ?? data.songInfo.videoTargetMap?.catbox?.[480]?.slice(0, 6);
        if (!webm) {
            infoDiv.innerHTML = '';
            return;
        }

        const songHistory = JSON.parse(localStorage.getItem('songHistory'));
        const current = songHistory[webm] ?? {count: 0, correctCount: 0.0, lastPlayed: 0, tracking: '', animeName: '', songName: '', artist: '', difficulty: 0, songEntry: '', annId: ''};
        if (quiz.isSpectator) {} else {
            current.count++;
            let isCorrect;
            if (quiz.gameMode === "Nexus") {
                isCorrect = data.players[0]?.correct;
            } else {
                isCorrect = data.players.find(player => player.gamePlayerId === quiz.ownGamePlayerId)?.correct;
            }
            if (isCorrect) {
                current.correctCount += 1;
                current.tracking += 'x';
            } else {
                current.tracking += 'o';
            }
            if (current.tracking.length > 8) {
                current.tracking = current.tracking.slice(-8);
            }
        }
        let validAnswers = data.songInfo.altAnimeNames.concat(data.songInfo.altAnimeNamesAnswers);
        let shortestAnswer = validAnswers.reduce(function(a, b) {
            return a.length < b.length ? a : b;
        });
        let songName = data.songInfo.songName;
        let artist = data.songInfo.artist;
        let difficulty = data.songInfo.animeDifficulty;
        if (difficulty === 'Unrated') {
            difficulty = 0;
        }
        let songType = ['opening', 'ending', 'insert'][data.songInfo.type - 1];
        if (songType !== 'insert') {
            songType += ' ' + data.songInfo.typeNumber;
        }
        let entry = data.songInfo.animeNames.english + ' ' + songType;
        let annId = data.songInfo.siteIds.annId;

        localStorage.setItem('songHistory', JSON.stringify({
            ...songHistory,
            [webm]: {
                count: current.count,
                correctCount: current.correctCount,
                lastPlayed: Date.now(),
                tracking: current.tracking,
                animeName: shortestAnswer,
                songName: songName,
                artist: artist,
                difficulty: difficulty,
                songEntry: entry,
                annId: annId,
            }
        }));

        let s = current.count > 1 ? "s" : "";
        let correctRatio = current.correctCount / (current.count);
        infoDiv.innerHTML = `Difficulty: <b>${difficulty.toFixed(3)}</b>`;
        infoDiv.innerHTML += `<br>Vintage: <b>${data.songInfo.vintage}</b>`;
        if (current.count) {
            infoDiv.innerHTML += `<br>Answered: <b>${current.correctCount}/${current.count}</b> (${(correctRatio * 100).toFixed(2)}%)`;
            infoDiv.innerHTML += `<br>Tracking: <b>${current.tracking}`;
        }
        infoDiv.innerHTML += `<br>Last played <b>${timeAgo(current.lastPlayed)}</b>`;
    };
    l.bindListener();

    /**
     * @param limit {string}
     * @param start {string}
     */
    function displaySongHistory(limit = '10', start = '1') {
        const songsPlayed = [];
        const songs = JSON.parse(localStorage.songHistory);

        for (const url in songs) {
            songs[url]['url'] = url;
            songsPlayed.push(songs[url]);
        }
        songsPlayed.sort((songA, songB) => songB.count - songA.count);
        if (songsPlayed.count < limit) {
            limit = `${songsPlayed.count}`;
        }
        if (start <= 0) {
            start = '1';
        }

        gameChat.systemMessage(`List of songs played (${start} - ${parseInt(limit) + parseInt(start) - 1}):`);
        for (let i = parseInt(start) - 1; i < parseInt(limit) + parseInt(start) - 1; i++) {
            /** @type {{count: number, correctCount: number, lastPlayed: number, url: string}} */
            const song = songsPlayed[i];
            gameChat.systemMessage(`${i+1}: <a href='https://files.catbox.moe/${song.url}.webm' target='_blank'>${song.songName}</a>: ${song.count} (${song.correctCount}/${song.count})`);
        }
    }


    AMQ_addScriptData({
        name: "Song History",
        author: "fluffyanimal (cloned from Minigamer42)",
        description: `<p>-- Browser Mode --<p>
        <p>Display the number of time a song played before and your guess rate on it in the song info window</p>`
    });

    AMQ_addCommand({
        command: 'songhistory',
        callback: displaySongHistory,
        description: 'Display song history ordered by count descending. Parameters default to 10 and 1'
    });
}
