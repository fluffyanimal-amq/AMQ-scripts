// ==UserScript==
// @name         AMQ Toggle Dropdown
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Lets you toggle dropdown on and off
// @author       fluffyanimal (cloned from Juvian)
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/fluffyanimal-amq/AMQ-scripts/raw/main/amqToggleDropdown.user.js
// @updateURL    https://github.com/fluffyanimal-amq/AMQ-scripts/raw/main/amqToggleDropdown.user.js
// ==/UserScript==

if (!window.AutoCompleteController) return;

const version = 0.1;

let enabled = true;
function changeEnabled() {
    enabled = !enabled;
    gameChat.systemMessage(enabled ? "Dropdown is enabled. Press [CTRL+B] to disable." : "Dropdown is disabled. Press [CTRL+B] to enable.");
    let controller = window?.quiz?.answerInput?.typingInput?.autoCompleteController;
    if (controller) {
        controller.newList();
    }
}

let officialList;
let oldNewList = AutoCompleteController.prototype.newList;
AutoCompleteController.prototype.newList = function () {
    if (this.list.length > 0) officialList = this.list;
    this.list = enabled ? officialList : [];
    oldNewList.apply(this, Array.from(arguments));
}

document.addEventListener ("keyup", function (event) {
    if (event.ctrlKey && event.key.toLowerCase() === 'b') {
        changeEnabled();
    }
});

AMQ_addScriptData({
    name: "AMQ Toggle Dropdown",
    author: "fluffyanimal",
    version: version,
    link: "https://github.com/fluffyanimal-amq/AMQ-scripts/raw/main/amqToggleDropdown.user.js",
    description: `
        <p>Disables dropdown so you miss every Prisma☆Illya entry. Press [Ctrl + B] to toggle.</p>
    `
});
