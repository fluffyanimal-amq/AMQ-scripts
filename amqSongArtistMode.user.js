// ==UserScript==
// @name         AMQ Song Artist Mode
// @namespace    https://github.com/fluffyanimal-amq
// @version      1.0
// @description  Makes you able to play song/artist with other people who have this script installed. Includes dropdown and scoretable.
// @author       fluffyanimal (cloned from 4Lajf)
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/simpleLogger.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/fluffyanimal-amq/AMQ-scripts/raw/main/amqSongArtistMode.user.js
// @updateURL    https://github.com/fluffyanimal-amq/AMQ-scripts/raw/main/amqSongArtistMode.user.js
// ==/UserScript==

if (document.getElementById('startPage')) {
    return;
}

// Wait until the LOADING... screen is hidden to setup script
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

function setup() {
    AMQ_addScriptData({
        name: "Song/Artist Mode",
        author: "fluffyanimal (cloned from 4Lajf)",
        description: "Lets you play S/A with other people who have this script installed. S/A dropdown requires fluffyanimal's localstorage song history script."
    });
    AMQ_addStyle(`
        .qpsPlayerRig {
            padding-right: 5px;
            opacity: 0.3;
        }
        .customCheckboxContainer {
            display: flex;
        }
        .customCheckboxContainer > div {
            display: inline-block;
            margin: 5px 0px;
        }
        .customCheckboxContainer > .customCheckboxContainerLabel {
            margin-left: 5px;
            margin-top: 5px;
            font-weight: normal;
        }
        .offset1 {
            margin-left: 20px;
        }
        .offset2 {
            margin-left: 40px;
        }
        .offset3 {
            margin-left: 60px;
        }
        .offset4 {
            margin-left: 80px;
        }
    `);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* Limits how many songs can be rendered when you type a keyword. Larger number means more lag and requires more computing power. */
let dropdownListLimit = 50

let enableBinary = true,
    playerDataReady = false,
    playerData = {},
    playerAmount = 0,
    titleValue,
    artistValue;

// listeners
let quizReadyRigTracker,
    answerResultsRigTracker,
    joinLobbyListener,
    spectateLobbyListener,
    quizEndTracker;

let artists = [];
let titles = [];
// get all distinct artists + titles from localstorage database
const songs = JSON.parse(localStorage.songHistory);
for (const url in songs) {
    let artist = songs[url].artist;
    let title = songs[url].songName;
    if (!artists.includes(artist)) {
        artists.push(artist);
    }
    if (!titles.includes(title)) {
        titles.push(title);
    }
}
// sorting so dropdown is shortest to longest
artists.sort((strA, strB) => strA.length - strB.length);
titles.sort((strA, strB) => strA.length - strB.length);

//This is a proxy to do a cross-origin API request to (presumably 4Lajf's) site
let cors_api_url = 'https://amq-proxy.herokuapp.com/';
async function doCORSRequest(options) {
    if (enableBinary === false) {
        return;
    }
    let x = new XMLHttpRequest();
    x.open(options.method, cors_api_url + options.url);
    x.onload = x.onerror = function () {
        if (options.type === 'titles') {
            titles = x.responseText;
            titles = JSON.parse(titles);
            titles = titles.body;
        }
        if (options.type === 'artists') {
            artists = x.responseText;
            artists = JSON.parse(artists);
            artists = artists.body;
        }
    };
    x.send(options.data);
}

//Alt+H to toggle S/A
async function changeMode(e) {
    if (e.altKey && e.key == 'h') {
        enableBinary = !enableBinary;
        gameChat.systemMessage(enableBinary ? "Song/Artist plugin has been ENABLED" : "Song/Artist plugin has been DISABLED");
        if (enableBinary === false) {
            let songArtistDOMElement = document.querySelector('#songartist');
            songArtistDOMElement.style.display = 'none';
            let playerScores = document.querySelectorAll('.qpsPlayerRig');
            for (let i = 0; i < playerScores.length; i++) {
                playerScores[i].style.display = 'none';
            }
        }
        if (enableBinary === true) {
            let songArtistDOMElement = document.querySelector('#songartist');
            songArtistDOMElement.style.display = 'block';
            let playerScores = document.querySelectorAll('.qpsPlayerRig');
            for (let i = 0; i < playerScores.length; i++) {
                playerScores[i].style.display = 'inline-block';
            }
        }
    }
}

// sets all player S/A scores to 0,0
function initPlayerData() {
    playerData = {}; // clearPlayerData()
    for (let entryId in quiz.players) {
        playerData[entryId] = {
            score_song: 0,
            score_artist: 0,
            name: quiz.players[entryId]._name
        };
    }
    playerDataReady = true;
}



// adds S/A scores of 0,0 to scoreboard
function initScoreboard() {
    $(".qpsPlayerRig").remove(); // clearScoreboard()
    for (let entryId in quiz.scoreboard.playerEntries) {
        let tmp = quiz.scoreboard.playerEntries[entryId];
        let rig = $(`<span class="qpsPlayerRig">0,0</span>`);
        tmp.$entry.find(".qpsPlayerName").before(rig);
    }
    let playerScores = document.querySelectorAll('.qpsPlayerRig');
    if (enableBinary === false) {
        for (let i = 0; i < playerScores.length; i++) {
            playerScores[i].style.display = 'none';
        }
    } else {
        for (let i = 0; i < playerScores.length; i++) {
            playerScores[i].style.display = 'inline-block';
        }
    }
}

// Initial setup on quiz start
quizReadyRigTracker = new Listener("quiz ready", async (data) => {
    //gameChat.systemMessage('S/A toggle enabled: [ALT+H]');
    document.addEventListener('keydown', changeMode);
    playerAmount = Object.entries(quiz.players).length;
    initPlayerData();
    initScoreboard();
    if (enableBinary === false) {
        return;
    }
    answerResultsRigTracker.bindListener();

    await sleep(2000);
})

// writes current S/A scores to scoreboard
function writeRigToScoreboard() {
    if (enableBinary === false) {
        return;
    }
    if (playerDataReady) {
        for (let entryId in quiz.scoreboard.playerEntries) {
            let entry = quiz.scoreboard.playerEntries[entryId];
            let guessedCounter = entry.$entry.find(".qpsPlayerRig");
            let playerScore = playerData[entryId].score_song + "," + playerData[entryId].score_artist;
            guessedCounter.text(playerScore);
            //quiz.scoreboard.playerEntries[entryId].$score[0].textContent = playerData[entryId].rig
        }
    }
}

// listener for answer reveal, only writes to scoreboard right now
answerResultsRigTracker = new Listener("answer results", async (result) => {
    if (enableBinary === false) {
        return;
    }
    for (let player of result.players) {
        if (player.correct === true) {
            //playerData[player.gamePlayerId].score++;
        }
    }
    await sleep(100);
    //console.log(playerData[0]);
    writeRigToScoreboard();
})

// Remove Alt+H listener on the end of the game
quizEndTracker = new Listener("quiz end result", (result) => {
    if (enableBinary === false) {
        return;
    }
    //gameChat.systemMessage('S/A toggle disabled');
    document.removeEventListener('keydown', changeMode);
    writeRigToScoreboard();
})

quizReadyRigTracker.bindListener();
answerResultsRigTracker.bindListener();
quizEndTracker.bindListener();

// Clears player data
function clearPlayerData() {
    if (enableBinary === false) {
        return;
    }
    playerData = {};
    playerDataReady = false;
}

// clears S/A scores from scoreboard
function clearScoreboard() {
    if (enableBinary === false) {
        return;
    }
    $(".qpsPlayerRig").remove();
}

// Reset data when joining a lobby
joinLobbyListener = new Listener("Join Game", async (payload) => {
    if (enableBinary === false) {
        return;
    }
    if (payload.error) {
        return;
    }
    if (payload.inLobby) {
        answerResultsRigTracker.unbindListener();
        clearPlayerData();
        clearScoreboard();
    }
})

// Reset data when spectating a lobby
spectateLobbyListener = new Listener("Spectate Game", (payload) => {
    if (enableBinary === false) {
        return;
    }
    if (payload.error) {
        return;
    }
    answerResultsRigTracker.bindListener();
    clearPlayerData();
    clearScoreboard();
})

joinLobbyListener.bindListener();
spectateLobbyListener.bindListener();

class SongArtistMode {
    #signature = 'sa-'
    #songHeader = 's'
    #artistHeader = 'a'
    #revealHeader = 'r'
    #teamHeader = 't'
    #hashHeader = 'h'
    #playerHashesSong = new Map()
    #playerHashesArtist = new Map()
    #playerHashesSongLocked = new Map()
    #playerHashesArtistLocked = new Map()
    #playerAnswersSong = new Map()
    #playerAnswersArtist = new Map()
    #playerSongScore = new Map()
    #playerArtistScore = new Map()
    #playerContainers = new Map()
    #currentSong = ""
    #currentArtist = ""
    debug = false

    #logger = new SimpleLogger("Song-Artist Mode")

    #songField
    #artistField
    constructor() {
        if (enableBinary === false) {
            return;
        }

        if (window.socket === undefined) {
            return
        }
        new window.Listener("game chat update", ({ messages }) => this.#handleMessages(messages)).bindListener()
        new window.Listener("Game Chat Message", (message) => this.#handleMessages([message])).bindListener()
        //team messages are sent instantly and alone instead of grouped up
        new window.Listener("answer results", ({ songInfo }) => this.#answerResults(songInfo)).bindListener()
        new window.Listener("guess phase over", this.#autoSubmit).bindListener()
        new window.Listener("player answers", this.#answerReveal).bindListener()
        new window.Listener("quiz ready", this.#reset).bindListener()
        new window.Listener("Game Starting", this.#reset).bindListener()
        new window.Listener("Join Game", this.#reset).bindListener()
        new window.Listener("play next song", this.#reset).bindListener()
        //new Listener("play next song", this.#clearAnswerFields)
        new window.Listener("Game Starting", this.#setupPlayers).bindListener()
        new window.Listener("Join Game", ({ quizState }) => this.#setupPlayers(quizState)).bindListener()

        const oldChatUpdate = window.gameChat._chatUpdateListener
        window.gameChat._chatUpdateListener = new window.Listener("game chat update", (payload) => {
            if (!this.debug) {
                payload.messages = payload.messages.filter(({ message }) => !message.startsWith(this.#signature))
            }
            oldChatUpdate.callback.apply(window.gameChat, [payload])
        })
        const oldGameChatMessage = window.gameChat._newMessageListner
        window.gameChat._newMessageListner = new window.Listener("Game Chat Message", (payload) => {
            if (this.debug || !payload.message.startsWith(this.#signature)) {
                oldGameChatMessage.callback.apply(window.gameChat, [payload])
            }
        })
    }

    /**
     * @param {number} value
     * @return {number} current value of logLevel
     */
    logLevel = (value) => {
        return this.#logger.logLevel = value
    }

    /**
     * @param {Object} object
     * @param {[{gamePlayerId: number, name: string}]} object.players
     */
    #setupPlayers = async ({ players }) => {
        while (window.quiz.players === undefined || window.quiz.players === null) {
            await this.#wait(250)//wait for quiz.players to finish setup
        }
        this.#playerContainers.clear()
        players
            .forEach(({ gamePlayerId, name }) => {
                this.#playerContainers.set(
                    name,
                    window.quiz.players[gamePlayerId].avatarSlot
                )
            })
        this.#playerContainers.forEach((avatarSlot) => {
            const animeAnswerContainer = avatarSlot.$answerContainer

            const songAnswerElement = animeAnswerContainer[0].cloneNode(true)
            songAnswerElement.style = "top:20px"
            avatarSlot.$innerContainer[0].appendChild(songAnswerElement)

            avatarSlot.$songAnswerContainer = $(songAnswerElement)
            avatarSlot.$songAnswerContainerText = avatarSlot.$songAnswerContainer.find(".qpAvatarAnswerText")


            const artistAnswerElement = animeAnswerContainer[0].cloneNode(true)
            artistAnswerElement.style = "top:60px"
            avatarSlot.$innerContainer[0].appendChild(artistAnswerElement)
            avatarSlot.$artistAnswerContainer = $(artistAnswerElement)
            avatarSlot.$artistAnswerContainerText = avatarSlot.$artistAnswerContainer.find(".qpAvatarAnswerText")
        })
    }

    #autoSubmit = () => {
        this.#logger.debug("autoSubmit triggered")
        if (this.#songField.value !== "" && this.#currentSong === "") {
            this.#submitSong(this.#songField.value)
        }
        if (this.#artistField.value !== "" && this.#currentArtist === "") {
            this.#submitArtist(this.#artistField.value)
        }
    }

    #showSong = (playerName, song, correct) => {
        const avatarSlot = this.#playerContainers.get(playerName)
        if (avatarSlot === undefined) {
            return
        }
        this.#showAnswer(playerName,
            song,
            correct,
            avatarSlot.$songAnswerContainer,
            avatarSlot.$songAnswerContainerText)
    }

    #showArtist = (playerName, artist, correct) => {
        const avatarSlot = this.#playerContainers.get(playerName)
        if (avatarSlot === undefined) {
            return
        }
        this.#showAnswer(playerName,
            artist,
            correct,
            avatarSlot.$artistAnswerContainer,
            avatarSlot.$artistAnswerContainerText)
    }

    #showAnswer(playerName, value, correct, $container, $text) {
        if (value === undefined || value === "") {
            $container[0].classList.add("hide")
        } else {
            $container[0].classList.remove("hide")
        }
        $text.text(value)
        if (correct !== undefined) {
            const classList = $text[0].classList;
            if (correct) {
                classList.add("rightAnswer")
            } else {
                classList.add("wrongAnswer")
            }
        }
        window.fitTextToContainer($text, $container, 23, 9)
    }

    #wait = (time) => {
        return new Promise((resolve, _) => {
            setTimeout(resolve, time)
        })
    }

    #reset = () => {
        this.#playerHashesSong.clear()
        this.#playerHashesArtist.clear()
        this.#playerHashesSongLocked.clear()
        this.#playerHashesArtistLocked.clear()
        this.#playerSongScore.clear()
        this.#playerArtistScore.clear()
        this.#playerAnswersSong.clear()
        this.#playerAnswersArtist.clear()

        this.#currentSong = ""
        this.#currentArtist = ""

        this.#setupAnswerArea()
        this.#songField.disabled = false
        this.#artistField.disabled = false
        this.#songField.value = ""
        this.#artistField.value = ""

        this.#playerContainers?.forEach((avatarSlot) => {
            avatarSlot.$songAnswerContainer[0].classList.add("hide")
            avatarSlot.$songAnswerContainerText.text("")
            avatarSlot.$songAnswerContainerText[0].classList.remove("wrongAnswer", "rightAnswer")
            avatarSlot.$artistAnswerContainer[0].classList.add("hide")
            avatarSlot.$artistAnswerContainerText.text("")
            avatarSlot.$artistAnswerContainerText[0].classList.remove("wrongAnswer", "rightAnswer")
        })
    }

    #setupAnswerArea = () => {
        if (document.getElementById("songartist")) {
            return
        }
        const answerInput = document.getElementById("qpAnswerInputContainer")
        const container = document.createElement("div")
        container.id = "songartist"
        const songContainer = document.createElement("div")
        songContainer.id = "song"
        const songTitlesInput = answerInput.cloneNode(true)
        const songTitlesAnswerField = songTitlesInput.childNodes[3]

        // Creating "title" input field
        songTitlesAnswerField.placeholder = "Song Title"
        songTitlesAnswerField.maxLength = "" + 150 - this.#signature.length - 2
        songTitlesInput.removeChild(songTitlesInput.childNodes[1])//remove skip button
        songContainer.appendChild(songTitlesInput)
        container.appendChild(songContainer)

        // Create autocomplete dropdown (ul) for titles field
        let dropdownFocus = -1
        const titlesList = document.createElement("ul");
        titlesList.id = "songs-list"
        titlesList.style = 'max-height: 190px; overflow: hidden; position: absolute; z-index: 9999 !important; width:100%; background: #424242; border: none; box-shadow: 0 0 10px 2px rgb(0 0 0); border-radius: 0.3em; margin: 0.2em 0 0; text-shadow: none; box-sizing: border-box; list-style: none; padding: 0;'
        songTitlesInput.appendChild(titlesList);

        let songDropdownItems = []

        const songsListElement = songTitlesInput.querySelector('#songs-list')
        const songsInputElement = songTitlesInput.querySelector('#qpAnswerInput')

        function closeDropdown(element) {
            element.innerHTML = ''
            dropdownFocus = -1
        }

        songsInputElement.addEventListener('input', function () {
            if (!songsInputElement.value) {
                closeDropdown(songsListElement)
            }

            if (songsInputElement.value) {
                titleValue = songsInputElement.value
                titleValue = titleValue.replace(/[^a-zA-Z0-9 ]/g, ' ')
                const filteredData = filterData(titles, titleValue)
                loadTitleData(filteredData, songsListElement)
                songDropdownItems = songsListElement.querySelectorAll('li')
            }
        })

        function filterData(data, query) {
            //Ignore everything that isn't a letter or a number
            return data.filter((x => x.replace(/[^a-zA-Z0-9 ]/g, ' ').toLowerCase().includes(query.toLowerCase())))
        }

        function loadTitleData(data, element) {

            let dataLength = data.length
            if (dataLength >= dropdownListLimit) {
                dataLength = dropdownListLimit;
                data.splice(dropdownListLimit, data.length);
            }

            // Create autocomplete dropdown elements for titles (li)
            if (data) {
                element.innerHTML = ''
                for (let i = 0; i < dataLength; i++) {
                    let el = document.createElement('li');
                    let songElIndex = data[i].toLowerCase().replace(/[^a-zA-Z0-9 ]/g, ' ').indexOf(titleValue.toLowerCase())
                    data[i] = `${data[i].substr(0, songElIndex)}<b style="color:#4497ea;">${data[i].substr(songElIndex, titleValue.length)}</b>${data[i].substr(titleValue.length + songElIndex, data[i].length)}`
                    el.innerHTML = data[i]
                    el.style = 'position: relative; padding: 0.2em 0.5em; cursor: pointer;'
                    el.type = "button"
                    el.setAttribute('onmouseover', `this.style.backgroundColor='#3d6d8f'`)
                    el.setAttribute('onmouseout', `this.style.backgroundColor='#424242'`)
                    el.setAttribute('onfocusin', `this.style.backgroundColor='#3d6d8f'`)
                    el.setAttribute('onfocusout', `this.style.backgroundColor='#424242'`)
                    //Required for ".focus()" to work
                    el.setAttribute('tabindex', '-1')
                    el.addEventListener('click', function () {
                        songsInputElement.value = el.innerText
                        closeDropdown(songsListElement)
                    });
                    element.appendChild(el);
                }
            }
        }

        // A hacky way to tell the dropdown to close once it's out of focus
        document.addEventListener("click", function () {
            closeDropdown(songsListElement)
        })

        songContainer.addEventListener('keydown', function (e) {
            if (e.key == 'ArrowDown') {
                dropdownFocus++
                if (dropdownFocus >= songDropdownItems.length) {
                    dropdownFocus = 0
                }
                songDropdownItems[dropdownFocus].focus()
            }
            if (e.key == 'ArrowUp') {
                dropdownFocus--
                if (dropdownFocus < 0) {
                    dropdownFocus = songDropdownItems.length - 1
                }
                songDropdownItems[dropdownFocus].focus()
            }
            if (e.key == 'Enter' && document.activeElement.innerText !== '') {
                songsInputElement.value = document.activeElement.innerText;
                closeDropdown(songsListElement);
                if (songArtistsAnswerField.value !== "") {
                    quiz.answerInput.submitAnswer(true);
                }
            }
            if (e.key == 'Escape') {
                closeDropdown(songsListElement)
            }
            if (e.key == 'Tab') {
                if (document.activeElement.innerText !== '') {
                    songsInputElement.value = document.activeElement.innerText
                }
                closeDropdown(songsListElement)
            }
        })

        // Creating "artist" input field
        const artistContainer = document.createElement("div")
        artistContainer.id = "artist"
        const songArtistsInput = answerInput.cloneNode(true)
        const songArtistsAnswerField = songArtistsInput.childNodes[3]
        songArtistsAnswerField.placeholder = "Artist"
        songArtistsAnswerField.maxLength = "" + 150 - this.#signature.length - 2
        songArtistsInput.removeChild(songArtistsInput.childNodes[1])//remove skip button
        artistContainer.appendChild(songArtistsInput)
        container.appendChild(artistContainer)

        // Creating autocomplete dropdown for artists (ul)
        const artistsList = document.createElement("ul");
        artistsList.id = "artists-list"
        artistsList.style = 'max-height: 190px; overflow: hidden; position: absolute; z-index: 9999 !important; width:100%;background: #424242; border: none; box-shadow: 0 0 10px 2px rgb(0 0 0); border-radius: 0.3em; margin: 0.2em 0 0; text-shadow: none; box-sizing: border-box; list-style: none; padding: 0;'
        songArtistsInput.appendChild(artistsList);

        let artisDropdownItems = []

        const artistsListElement = songArtistsInput.querySelector('#artists-list')
        const artistsInputElement = songArtistsInput.querySelector('#qpAnswerInput')

        artistsInputElement.addEventListener('input', function () {
            if (!artistsInputElement.value) {
                closeDropdown(artistsListElement)
            }

            if (artistsInputElement.value) {
                artistValue = artistsInputElement.value
                artistValue = artistValue.replace(/[^a-zA-Z0-9 ]/g, ' ')
                const filteredData = filterData(artists, artistValue)
                loadArtistData(filteredData, artistsListElement)
                artisDropdownItems = artistsListElement.querySelectorAll('li')
            }
        })

        function loadArtistData(data, element) {
            let dataLength = data.length
            if (dataLength >= dropdownListLimit) {
                dataLength = dropdownListLimit;
                data.splice(dropdownListLimit, data.length);
            }

            if (data) {
                element.innerHTML = ''
                // Creating autocomplete dropdown elements for artists (li)
                for (let i = 0; i < dataLength; i++) {
                    let el = document.createElement('li');
                    let songElIndex = data[i].toLowerCase().replace(/[^a-zA-Z0-9 ]/g, ' ').indexOf(artistValue.toLowerCase())
                    data[i] = `${data[i].substr(0, songElIndex)}<b style="color:#4497ea;">${data[i].substr(songElIndex, artistValue.length)}</b>${data[i].substr(artistValue.length + songElIndex, data[i].length)}`
                    el.innerHTML = data[i]
                    el.style = 'position: relative; padding: 0.2em 0.5em; cursor: pointer;'
                    el.type = "button"
                    el.setAttribute('onmouseover', `this.style.backgroundColor='#3d6d8f'`)
                    el.setAttribute('onmouseout', `this.style.backgroundColor='#424242'`)
                    el.setAttribute('onfocusin', `this.style.backgroundColor='#3d6d8f'`)
                    el.setAttribute('onfocusout', `this.style.backgroundColor='#424242'`)
                    //Required for ".focus()" to work
                    el.setAttribute('tabindex', '-1')
                    el.addEventListener('click', function () {
                        artistsInputElement.value = el.innerText
                        closeDropdown(artistsListElement)
                    });
                    element.appendChild(el);
                }
            }
        }

        // A hacky way to tell the dropdown to close once it's out of focus
        document.addEventListener("click", function () {
            closeDropdown(artistsListElement)
        })

        artistContainer.addEventListener('keydown', function (e) {
            if (e.key == 'ArrowDown') {
                dropdownFocus++
                if (dropdownFocus >= artisDropdownItems.length) {
                    dropdownFocus = 0
                }
                artisDropdownItems[dropdownFocus].focus()
            }
            if (e.key == 'ArrowUp') {
                dropdownFocus--
                if (dropdownFocus < 0) {
                    dropdownFocus = artisDropdownItems.length - 1
                }
                artisDropdownItems[dropdownFocus].focus()
            }
            if (e.key == 'Enter' && document.activeElement.innerText !== '') {
                artistsInputElement.value = document.activeElement.innerText;
                closeDropdown(artistsListElement);
                if (songTitlesAnswerField.value !== "") {
                    quiz.answerInput.submitAnswer(true);
                }
            }
            if (e.key == 'Escape') {
                closeDropdown(artistsListElement)
            }
            if (e.key == 'Tab') {
                if (document.activeElement.innerText !== '') {
                    artistsInputElement.value = document.activeElement.innerText
                }
                closeDropdown(artistsListElement)
            }
        })

        const parent = document.getElementById("qpAnimeCenterContainer")
        parent.appendChild(container)

        this.#songField = songTitlesAnswerField
        this.#artistField = songArtistsAnswerField
        this.#songField.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                if (this.#artistField.value !== "") {
                    //this.#submitSong(this.#songField.value);
                    closeDropdown(songsListElement);
                    quiz.answerInput.submitAnswer(true);
                }
            }
        })
        this.#artistField.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                if (this.#songField.value !== "") {
                    //this.#submitArtist(this.#artistField.value);
                    closeDropdown(artistsListElement);
                    quiz.answerInput.submitAnswer(true);
                }
            }
        })
    }

    /**
     * @param {[{sender: string, message: string}]} messages
     */
    #handleMessages = (messages) => {
        messages
            .filter(({ message }) => message.startsWith(this.#signature))
            .map(this.#stripMessage)
            .forEach(this.#updatePlayer)
    }

    /**
     * @param {Object} messageObject
     * @param {string} messageObject.sender
     * @param {string} messageObject.message
     * @return {{sender: string, message: string}} message stripped of signature, same sender
     */
    #stripMessage = ({ message, sender }) => {
        return {
            message: message.substring(this.#signature.length),
            sender
        }
    }

    /**
     * @param {Object} messageObject
     * @param {string} messageObject.sender
     * @param {string} messageObject.message
     */
    #updatePlayer = ({ message, sender }) => {
        const content = message.substring(2)
        switch (message.substring(0, 2)) {
            case this.#hashHeader + this.#songHeader:
                this.#playerHashesSong.set(sender, content)
                break
            case this.#hashHeader + this.#artistHeader:
                this.#playerHashesArtist.set(sender, content)
                break
            case this.#revealHeader + this.#songHeader:
                this.#handleRevealSong(sender, content)
                break
            case this.#revealHeader + this.#artistHeader:
                this.#handleRevealArtist(sender, content)
                break
            case this.#teamHeader + this.#songHeader:
                this.#handleTeamRevealSong(sender, content)
                break
            case this.#teamHeader + this.#artistHeader:
                this.#handleTeamRevealArtist(sender, content)
                break
        }
    }

    /**
     * @param {string} sender
     * @param {string} content
     * @param {boolean | undefined} correct
     */
    #handleRevealSong = (sender, content, correct) => {
        this.#handleReveal(sender, content, this.#playerHashesSongLocked, this.#playerAnswersSong)
        this.#showSong(sender, this.#playerAnswersSong.get(sender), correct)
    }

    /**
     * @param {string} sender
     * @param {string} content
     * @param {boolean | undefined} correct
     */
    #handleRevealArtist = (sender, content, correct) => {
        this.#handleReveal(sender, content, this.#playerHashesArtistLocked, this.#playerAnswersArtist)
        this.#showArtist(sender, this.#playerAnswersArtist.get(sender), correct)
    }

    /**
     * @param {string} sender
     * @param {string} content
     */
    #handleTeamRevealSong = (sender, content) => {
        this.#handleReveal(sender, content, this.#playerHashesSong, this.#playerAnswersSong)
        this.#showSong(sender, this.#playerAnswersSong.get(sender))
    }

    /**
     * @param {string} sender
     * @param {string} content
     */
    #handleTeamRevealArtist = (sender, content) => {
        this.#handleReveal(sender, content, this.#playerHashesArtist, this.#playerAnswersArtist)
        this.#showArtist(sender, this.#playerAnswersArtist.get(sender))
    }

    /**
     * @param {string} sender
     * @param {string} content
     * @param {Map<String, String>} hashMap
     * @param {Map<String, String>} answerMap
     */
    #handleReveal = (sender, content, hashMap, answerMap) => {
        const hash = hashMap.get(sender) ?? ""
        if (this.#isCorrect(content, sender, hash)) {
            answerMap.set(sender, content)
            this.#logger.info("reveal handling", `${sender} did send the answer ${content}`)
        } else {
            this.#logger.error("Mismatch between hash and answer", `${sender} : ${content}`)
        }
    }

    /**
     * @param {Object} songInfo
     * @param {string} songInfo.artist
     * @param {string} songInfo.songName
     */
    #answerResults = ({ artist, songName }) => {
        this.#songNameAnswerResultsHelper(songName,
            this.#playerHashesSongLocked,
            this.#playerSongScore,
            this.#playerAnswersSong,
            this.#handleRevealSong)
        this.#artistAnswerResultsHelper(artist,
            this.#playerHashesArtistLocked,
            this.#playerArtistScore,
            this.#playerAnswersArtist,
            this.#handleRevealArtist)
    }

    /**
     * @param {String} value
     * @param {Map<String, String>} hashesMap
     * @param {Map<String, String>} scoreMap
     * @param {Map<String, String>} answerMap
     * @param {Function<string, string, undefined|boolean>} revealFunction
     */
    #artistAnswerResultsHelper = (value, hashesMap, scoreMap, answerMap, revealFunction) => {
        hashesMap.forEach((answer, sender) => {

            if (!answerMap.get(sender)) {
                answerMap.set(sender, '')
            }

            if (this.#isCorrect(value, sender, answer)) {
                for (let i = 0; i < playerAmount; i++) {
                    if (quiz.players[i]._name === sender) {
                        playerData[i].score_artist++;
                    }
                }
                writeRigToScoreboard();
                const displayAnswer = answerMap.get(sender) ?? value
                revealFunction(sender, displayAnswer, true)
            } else {
                const displayAnswer = answerMap.get(sender) ?? "WRONG"
                revealFunction(sender, displayAnswer, false)
            }
        }
        )
    }

    /**
     * @param {String} value
     * @param {Map<String, String>} hashesMap
     * @param {Map<String, String>} scoreMap
     * @param {Map<String, String>} answerMap
     * @param {Function<string, string, undefined|boolean>} revealFunction
     */
     #songNameAnswerResultsHelper = (value, hashesMap, scoreMap, answerMap, revealFunction) => {
        hashesMap.forEach((answer, sender) => {

            if (!answerMap.get(sender)) {
                answerMap.set(sender, '')
            }

            if (this.#isCorrect(value, sender, answer)) {
                for (let i = 0; i < playerAmount; i++) {
                    if (quiz.players[i]._name === sender) {
                        playerData[i].score_song++;
                    }
                }
                writeRigToScoreboard();
                const displayAnswer = answerMap.get(sender) ?? value
                revealFunction(sender, displayAnswer, true)
            } else {
                const displayAnswer = answerMap.get(sender) ?? "WRONG"
                revealFunction(sender, displayAnswer, false)
            }
        }
        )
    }

    /**
     * @param {String} value
     * @param {String} sender
     * @param {String} answer
     * @return {boolean}
     */
    #isCorrect = (value, sender, answer) => {
        const hash = answer.substring(0, 16)
        const timestamp = answer.substring(16)
        return hash === this.#hash(value, sender, timestamp)
    }

    #submitSong = (song) => {
        song = song.trim()
        this.#submit(this.#hashHeader + this.#songHeader, song).then(() => {
            this.#teamSubmit(this.#teamHeader + this.#songHeader, song)
        })
        this.#logger.debug("Submitted song", song)
        this.#currentSong = song
    }

    #submitArtist = (artist) => {
        artist = artist.trim()
        this.#submit(this.#hashHeader + this.#artistHeader, artist).then(() => {
            this.#teamSubmit(this.#teamHeader + this.#artistHeader, artist)
        })
        this.#logger.debug("Submitted artist", artist)
        this.#currentArtist = artist
    }

    #teamSubmit = (header, value) => {
        if (window.quiz.teamMode) {
            let teamMessage = false
            for (let index in window.quiz.players) {
                //for some dumb reason players is an object
                const player = window.quiz.players[index]
                if (player.teamNumber !== 1) {
                    teamMessage = true
                    break
                }
            }
            this.#sendMessage(this.#signature + header + value, teamMessage)
        }
    }

    /**
     * @param {String} header
     * @param {String} value
     */
    #submit = (header, value) => {
        const timestamp = Date.now().toString(16).toUpperCase()
        const hash = this.#hash(value, window.selfName, timestamp)
        const message = this.#signature + header + hash + timestamp
        return this.#sendMessage(message)
    }

    /**
     * @param {String} inputString
     * @param {String} sender
     * @param timestamp string unix timestamp in hexadecimal
     * @return {String} 64-bit hash in hexadecimal
     */
    #hash = (inputString, sender, timestamp) => {
        const first = this.#calculateHash(inputString, sender, timestamp)
        const reverseInput = inputString
            .split("")
            .reverse()
            .join("")
        const second = this.#calculateHash(reverseInput, sender, timestamp)

        const radix = 16
        const hash = first.toString(radix).padEnd(8, '0') + second.toString(radix).padEnd(8, '0')
        return hash.toUpperCase()
    }

    /**
     * @param {string} inputString
     * @param {string} sender
     * @param {string} timestamp string unix timestamp in hexadecimal
     * @return Number
     */
    #calculateHash = (inputString, sender, timestamp) => {
        return this.#hashCode(sender + inputString + timestamp)
    }

    /**
     * Returns a hash code from a string
     * @param  {String} str The string to hash.
     * @return {Number}    A 32bit integer
     * @see https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
     */
    #hashCode = (str) => {
        const spice = "alphanumeric"
        //during testing, I found the last letter to heavily impact the first byte pair of the hash
        //the spice should shift that away
        str += spice
        str = str.toLowerCase()
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            let chr = str.charCodeAt(i)
            hash = (hash << 5) - hash + chr
            hash |= 0 // Convert to 32bit integer
        }
        return Math.abs(hash)
    }

    #lockAnswers = () => {
        this.#playerHashesSongLocked = new Map(this.#playerHashesSong)
        this.#playerHashesArtistLocked = new Map(this.#playerHashesArtist)
        this.#songField.disabled = true
        this.#artistField.disabled = true
        this.#songField.value = this.#currentSong
        this.#artistField.value = this.#currentArtist
    }

    #answerReveal = () => {
        this.#lockAnswers()
        const template = (header, value) => `${this.#answerRevealHeader(header)}${value}`
        if (this.#currentSong !== "") {
            const msg = template(this.#songHeader, this.#currentSong)
            this.#sendMessage(msg);
        }
        if (this.#currentArtist !== "") {
            const msg = template(this.#artistHeader, this.#currentArtist)
            this.#sendMessage(msg);
        }
    }

    #answerRevealHeader = (header) => {
        return `${this.#signature}${this.#revealHeader}${header}`
    }

    /**
     * @param {String} msg
     * @param {boolean} teamMessage
     * @return {Promise<boolean>} true on success, false on timeout
     */
    #sendMessage = (msg, teamMessage = false) => {
        const promise = new Promise((resolve, _) => {
            let timeout
            let listener
            if (teamMessage) {
                listener = new window.Listener("Game Chat Message", ({ message, sender }) => {
                    if (sender === window.selfName && message === msg) {
                        resolve(true)
                        listener.unbindListener()
                        clearTimeout(timeout)
                    }
                })
                listener.bindListener()
            } else {
                listener = new window.Listener("game chat update", ({ messages }) => {
                    const found = messages.some(({ sender, message }) => sender === window.selfName && message === msg)
                    if (found) {
                        resolve(true)
                        listener.unbindListener()
                        clearTimeout(timeout)
                    }
                })
                listener.bindListener()
            }
            timeout = setTimeout(() => {
                resolve(false)
                listener.unbindListener()
                this.#logger.warn("Message not sent (timeout)", msg)
            }, 2000)
        })
        window.socket.sendCommand({
            type: "lobby",
            command: "game chat message",
            data: {
                msg,
                teamMessage,
            }
        })
        this.#logger.info("Sent Message", msg)
        return promise
    }
}

if (enableBinary === true) {
    window.songArtist = new SongArtistMode()
}
