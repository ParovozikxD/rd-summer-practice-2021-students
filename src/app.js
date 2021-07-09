'use strict';
// utilities
(function(app) {
    (function(utils) {
        utils.getStatusName = function (statusId) {
            var status = "Открыта регистрация";
            switch (statusId) {
                case GameApi.GameStatus.open:
                    break;
                case GameApi.GameStatus.ready:
                    status = "Готова к старту";
                    break;
                case GameApi.GameStatus.starting:
                    status = "Стартует";
                    break;
                case GameApi.GameStatus.inProcess:
                    status = "В процессе";
                    break;
                case GameApi.GameStatus.paused:
                    status = "На паузе";
                    break;
                case GameApi.GameStatus.canceled:
                    status = "Отменена";
                    break;
                case GameApi.GameStatus.finished:
                    status = "Завершена";
                    break;
                default:
                    status = "Ошибочный статус";
                    break;
            }
            return status;
        };

        utils.canUserCancelGame = function (gameApi, gameInfo) {
            if (gameInfo.status === GameApi.GameStatus.canceled &&
                gameInfo.status === GameApi.GameStatus.finished) {
                return false;
            }
            return gameInfo && gameInfo.owner && gameInfo.owner.id &&
                gameApi && gameApi.questor && gameApi.questor.user &&
                (gameApi.questor.user.isAdmin ||
                gameInfo.owner.id.toLowerCase() === gameApi.questor.user.id.toLowerCase());
        };

        utils.unpackMap = function (map) {
            var i, location;
            var unpacked = [];
            var cellCount = map.width * map.height;
            //fill blanks
            for (i = 0; i < cellCount; i++) {
                unpacked.push(GameApi.MapCellType.empty);
            }
            for (i = 0; i < map.cells.length; i++) {
                var cell = map.cells[i];
                location = cell.location.y * map.width + cell.location.x;
                if (cell.type !== GameApi.MapCellType.policeRespawn &&
                    cell.type !== GameApi.MapCellType.thiefRespawn) {
                    unpacked[location] = cell.type;
                }
            }

            return { width: map.width, height: map.height, cells: unpacked };
        };

        utils.t = function (s, d) {
            for (var p in d) {
                s = s.replace(new RegExp('{' + p + '}', 'g'), d[p]);
            }
            return s;
        }
    })(app.utils = app.utils || {});
})(window.app = window.app || {});

// game list
(function(app, $){
    (function(gameList){
        gameList.GameTable = (function() {
            var tableHeader =
                "<tr>" +
                    "<td colspan='7' class='idx-game-header'>Список активных игр</td>" +
                "</tr>" +
                "<tr class='idx-game-col-header'>" +
                    "<th>Имя</th>" +
                    "<th>Автор</th>" +
                    "<th>Создана</th>" +
                    "<th>Статус</th>" +
                    "<th>Макс. Пол./Мош.</th>" +
                    "<th>Подкл. Пол./Мош.</th>" +
                    "<th></th>" +
                "</tr>";
            var tableFooter =
                "<tr>" +
                    "<td colspan='7' class='idx-game-footer'>" +
                        "<a class='idx-create-game-link link-btn' href='newgame.html'>Создать Игру</a>" +
                    "</td>" +
                "</tr>";
            var tableRow =
                "<tr class='idx-game-row game-status-{status}'>" +
                    "<td>" +
                        "<a class='idx-game-link' href='game.html?gameId={gameId}'>{name}</a>" +
                    "</td>" +
                    "<td>{owner}</td>" +
                    "<td>{created}</td>" +
                    "<td>{statusName}</td>" +
                    "<td>{maxTeamSize}/{maxTeamSize}</td>" +
                    "<td>{teamPoliceSize}/{teamThiefSize}</td>" +
                "</tr>";
            var gameCancel = "<a class='idx-game-cancel' href='#'>Завершить</a>";

            function GameTable($table, $loading, $error, gameApi) {
                this.$table = $table;
                this.$loading = $loading;
                this.$error = $error;
                this.gameApi = gameApi;
            }
            GameTable.prototype.addRows = function (testInfo, gameInfos) {
                this.clear();
                this.$table.append($(tableHeader));
                if (testInfo) {
                    this.addRow(testInfo, true);
                }
                if (gameInfos && gameInfos.length > 0) {
                    for (var i = 0; i < gameInfos.length; i++) {
                        this.addRow(gameInfos[i], false);
                    }
                }
                this.$table.append($(tableFooter));
            };
            GameTable.prototype.addRow = function (gameInfo, test) {
                var thiefCount = 0;
                var policeCount = 0;
                if (gameInfo.team1Stats.role === GameApi.GameTeamRole.thief) {
                    thiefCount = gameInfo.team1Stats.size;
                    policeCount = gameInfo.team2Stats.size;
                }
                else {
                    thiefCount = gameInfo.team2Stats.size;
                    policeCount = gameInfo.team1Stats.size;
                }
                var templateData = {
                    name: gameInfo.name + (test ? " (Тестовая)" : ""),
                    status: gameInfo.status,
                    statusName: app.utils.getStatusName(gameInfo.status),
                    gameId: test ? "test" : gameInfo.id,
                    owner: gameInfo.owner.nativeName,
                    created: new Date(gameInfo.createdAtUTC).toLocaleString(),
                    maxTeamSize: gameInfo.maxTeamSize,
                    teamPoliceSize: policeCount,
                    teamThiefSize: thiefCount
                };
                var $row = $(app.utils.t(tableRow, templateData));
                var $actionsColumn = $("<td/>");
                if (app.utils.canUserCancelGame(this.gameApi, gameInfo) &&
                    gameInfo.status !== GameApi.GameStatus.finished &&
                    gameInfo.status !== GameApi.GameStatus.canceled) {
                    var $cancelAction = $(gameCancel);
                    $cancelAction.click(function (event) {
                        event.preventDefault();
                        this.cancel(gameInfo.id, test);
                    }.bind(this));
                    $actionsColumn.append($cancelAction);
                } else {
                    $actionsColumn.html("&nbsp;");
                }
                $row.append($actionsColumn);
                this.$table.append($row);
            };
            // Game API
            GameTable.prototype.load = function () {
                this.showLoading();
                var callback = function (testGame, error) {
                    if (!testGame && error && error.status !== 404) {
                        this.showError();
                        return;
                    }
                    this.gameApi.games.get(function (games, error) {
                        if (!games && error) {
                            this.showError();
                        } else {
                            this.addRows(testGame, games);
                            this.show();
                        }
                    }.bind(this));
                }.bind(this);
                this.gameApi.games.getTest(callback);
            };
            GameTable.prototype.cancel = function (gameId, test) {
                this.showLoading();
                var callback = function (result, error) {
                    if (!result && error) {
                        this.showError();
                    }
                    else {
                        this.load();
                    }
                }.bind(this);
                if (test) {
                    this.gameApi.games.cancelTest(callback);
                }
                else {
                    this.gameApi.games.cancel(gameId, callback);
                }
            };
            GameTable.prototype.showLoading = function () {
                this.$table.addClass("hidden");
                this.$error.addClass("hidden");
                this.$loading.removeClass("hidden");
            };
            GameTable.prototype.showError = function () {
                this.$table.addClass("hidden");
                this.$loading.addClass("hidden");
                this.$error.removeClass("hidden");
            };
            GameTable.prototype.show = function () {
                this.$loading.addClass("hidden");
                this.$error.addClass("hidden");
                this.$table.removeClass("hidden");
            };
            GameTable.prototype.clear = function () {
                this.$table.empty();
            };
            return GameTable;
        })();
    })(app.gameList = app.gameList || {});
})(window.app = window.app || {}, $);

// new game form
(function(app, $) {
    (function (newGame) {
        newGame.GameForm = (function(){
            var mapName = "{name} [{owner}] ({width}x{height}) {{policeCount}:{thiefCount}}";
            var mapSelectOption = "<option value='{mapId}'>{mapName}</option>";

            function GameForm($form, $formContainer, $mapSelect, $gameListBtn, $createGameBtn,
                              $loading, $error, gameApi) {
                this.$form = $form;
                this.$formContainer = $formContainer;
                this.$mapSelect = $mapSelect;
                this.$loading = $loading;
                this.$error = $error;
                this.gameApi = gameApi;

                this.bindActions($createGameBtn, $gameListBtn);
            }

            function getMapName(map) {
                var templateData = {
                    name: map.name ,
                    owner: map.owner.nativeName,
                    width: map.width,
                    height: map.height,
                    policeCount: map.policeCount,
                    thiefCount: map.thiefCount
                };
                return app.utils.t(mapName, templateData);
            }

            GameForm.prototype.bindActions = function ($createGameBtn, $gameListBtn) {
                $gameListBtn.click(function (event) {
                    event.preventDefault();
                    window.location.replace("index.html");
                });
                $createGameBtn.click(function (event) {
                    event.preventDefault();
                    this.create();
                }.bind(this));
                this.$form.submit(function(event) {
                    event.preventDefault();
                    this.create(true);
                }.bind(this));
            };
            GameForm.prototype.create = function (openCreated) {
                this.showLoading();
                var gameObj = this.getGameObjectFromForm();
                var callback = function (game, error) {
                    if (!game && error) {
                        this.showError();
                    }
                    else {
                        if (openCreated) {
                            window.location.replace(
                                app.utils.t("game.html?gameId={gameId}", {
                                    gameId: gameObj.test ? "test" : game.id
                                }));
                        } else {
                            //redirect to the game list
                            window.location.replace("index.html");
                        }
                    }
                }.bind(this);
                if (gameObj.test) {
                    this.gameApi.games.createTest(gameObj.game, callback);
                }
                else {
                    this.gameApi.games.create(gameObj.game, callback);
                }
            };
            GameForm.prototype.getGameObjectFromForm = function () {
                var values = this.$form.serializeArray();
                var valuesMap = {};
                $.map(values, function(v) {valuesMap[v.name] = v.value});
                var test = valuesMap.gtest === "on";
                var game = {};
                game.name = valuesMap.gname;
                game.mapId = valuesMap.gmapid;
                game.switchTimeout = parseInt(valuesMap.gswitch);
                game.startupTeamLives = parseInt(valuesMap.glives);
                game.policeSpeed = parseFloat(valuesMap.gpolicespeed);
                game.thiefSpeed = parseFloat(valuesMap.gthiefspeed);
                return {
                    game: game,
                    test: test
                };
            };
            GameForm.prototype.loadMaps = function () {
                this.showLoading();
                var callback = function(maps, error){
                    if (!maps && error) {
                        this.showError();
                    }
                    else {
                        this.addSelectMapOptions(maps);
                        this.show();
                    }
                }.bind(this);
                this.gameApi.maps.get(callback);
            };
            GameForm.prototype.addSelectMapOption = function (map) {
                var templateData = {
                    mapId: map.id,
                    mapName: getMapName(map)
                };
                this.$mapSelect.append(app.utils.t(mapSelectOption, templateData));
            };
            GameForm.prototype.addSelectMapOptions = function (maps) {
                this.$mapSelect.empty();
                if (!maps) {
                    return;
                }
                for(var i = 0; i < maps.length; i++){
                    this.addSelectMapOption(maps[i]);
                }
            };
            GameForm.prototype.showLoading = function () {
                this.$formContainer.addClass("hidden");
                this.$error.addClass("hidden");
                this.$loading.removeClass("hidden");
            };
            GameForm.prototype.showError = function () {
                this.$formContainer.removeClass("hidden");
                this.$loading.addClass("hidden");
                this.$error.removeClass("hidden");
            };
            GameForm.prototype.show = function () {
                this.$loading.addClass("hidden");
                this.$error.addClass("hidden");
                this.$formContainer.removeClass("hidden");
            };

            return GameForm;
        })();
    })(app.newGame = app.newGame || {});
})(window.app = window.app || {}, $);

// game.html State
(function (app, $) {
    (function (game) {
        game.GameState = (function() {
            function createCallbacks() {
                return {
                    syncing: $.Callbacks(),
                    synced: $.Callbacks(),
                    captionChanged: $.Callbacks(),
                    timerChanged: $.Callbacks(),
                    mapChanged: $.Callbacks(),
                    teamCaptionChanged: $.Callbacks(),
                    teamLivesChanged: $.Callbacks(),
                    teamCoinsChanged: $.Callbacks(),
                    teamPlayersChanged: $.Callbacks(),
                    playerChanged: $.Callbacks(),
                    statusChanged: $.Callbacks(),
                    invalidGame: $.Callbacks()
                };
            }

            function createPlayerFromStats(stats, existingPlayer) {
                var player = existingPlayer || {};
                player.id = stats.userId;
                player.name = stats.login;
                player.coins = stats.coinsCollected;
                player.lives = stats.livesCollected;
                player.deaths = stats.deaths;
                player.alive = stats.alive;
                player.connected = stats.connected;
                player.x = stats.location.x;
                player.y = stats.location.y;
                return player;
            }

            function createTeamFromStats(stats) {
                var team = {};
                team.id = stats.teamId;
                team.name = stats.name;
                team.role = stats.role;
                team.lives = stats.currentLives;
                team.coins = stats.coinsCollected;
                team.winner = stats.winner;
                team.players = {};
                for(var i = 0; i < stats.playerStats.length; i++) {
                    var player = createPlayerFromStats(stats.playerStats[i]);
                    team.players[player.id] = player;
                }

                return team;
            }

            function GameState(gameApi) {
                this.gameApi = gameApi;
                this.callbacks = createCallbacks();
                this.game = null;
                this.name = "";
                this.owner = {};
                this.status = GameApi.GameStatus.open;
                this.millisecondsToSwitch = 0;
                this.millisecondsToSwitchDate = Date.now();
                this.switchTimeout = 0;
                this.switchTimer = null;
                this.teams = {
                    team1: {players: null},
                    ream2: {players: null}
                };
                this.map = {};
            }
            GameState.prototype.request = function () {
                if (!this.game) {
                    this.callbacks.syncing.fire();
                    this.game = this.gameApi.subscribe();
                    this.game.onError(function (error) {
                        console.log(error);
                        if (error) {
                            if (error.error === 'invalidGame') {
                                this.callbacks.synced.fire(false, error);
                            }
                        }
                    }.bind(this));
                    this.listen();
                }
            };
            GameState.prototype.listen = function () {
                this.game.onSync(function (data) {
                    this.sync(data);
                }.bind(this));

                this.game.onStarting(function (data) {
                    this.setStatus(GameApi.GameStatus.starting);
                }.bind(this));

                this.game.onStarted(function (data) {
                    this.setStatus(GameApi.GameStatus.inProcess);
                    this.setMillisecondsToSwitch(data.millisecodsToSwitch);
                }.bind(this));

                this.game.onPaused(function () {
                    this.setStatus(GameApi.GameStatus.paused);
                }.bind(this));

                this.game.onCanceled(function () {
                    this.setStatus(GameApi.GameStatus.canceled);
                }.bind(this));

                this.game.onFinished(function (data) {
                    this.setWinners(data.teamId);
                }.bind(this));

                this.game.onCoinsChanged(function(data) {
                    this.setTeamCoins(data.teamId, data.coins);
                }.bind(this));

                this.game.onLivesChanged(function (data) {
                    this.setTeamLives(data.teamId, data.lives);
                }.bind(this));

                this.game.onCellChanged(function (data) {
                    this.setMapCell(data.x, data.y, data.type);
                }.bind(this));

                this.game.onRolesSwitched(function (data) {
                    var t = data[0];
                    this.setTeamRole(t.teamId, t.role);
                    t = data[1];
                    this.setTeamRole(t.teamId, t.role);
                    this.setMillisecondsToSwitch();
                }.bind(this));

                this.game.onPlayerJoined(function (data) {
                    this.addPlayerFromStats(data.teamId, data.stats);
                }.bind(this));

                this.game.onPlayerLeft(function (data) {
                    this.removePlayer(data.user.id);
                }.bind(this));

                this.game.onPlayerMoved(function (data) {
                    this.movePlayer(data.userId, data.location.x, data.location.y);
                }.bind(this));

                this.game.onPlayerDied(function (data) {
                    this.kill(data.userId);
                }.bind(this));

                this.game.onPlayerRespawned(function (data) {
                    this.respawn(data.userId, data.location.x, data.location.y);
                }.bind(this));

                this.game.onLifeCollected(function (data) {
                    this.addLifeCollected(data.userId);
                }.bind(this));

                this.game.onCoinCollected(function (data) {
                    this.addCoinCollected(data.userId);
                }.bind(this));

                this.game.onAny(function (data) {
                    if (data && data.message) {
                        //console.log('Log:', data.message, data.data);
                    }
                }.bind(this));
            };
            GameState.prototype.setStatus = function (status) {
                this.status = status;
                this.millisecondsToSwitchDate = Date.now();
                this.runTimer();
                this.callbacks.captionChanged.fire(this.name, this.status);
                this.callbacks.statusChanged.fire(this.status);
                this.callbacks.mapChanged.fire(this.map);
            };
            GameState.prototype.setTimer = function () {
                if (this.status !== GameApi.GameStatus.inProcess) {
                    return false;
                }
                var msSpend = Date.now() - this.millisecondsToSwitchDate;
                if (msSpend >= this.millisecondsToSwitch) {
                    this.callbacks.timerChanged.fire({m: 0, s: 0, total: 0}, this.switchTimeout);
                    return false;
                }
                var ms = this.millisecondsToSwitch - msSpend;
                this.millisecondsToSwitchDate += msSpend;
                this.millisecondsToSwitch -= msSpend;
                var seconds = Math.floor(ms/1000);
                var minutes = Math.floor(seconds/60);
                seconds = seconds - minutes * 60;
                this.callbacks.timerChanged.fire({m: minutes, s: seconds, total: ms}, this.switchTimeout);
                return true;
            };
            GameState.prototype.runTimer = function () {
                if (this.switchTimer) {
                    clearTimeout(this.switchTimer);
                }
                var timeout = 1000;
                var callback = function () {
                    if (this.setTimer()) {
                        this.switchTimer = setTimeout(callback, timeout);
                    }
                }.bind(this);
                this.switchTimer = setTimeout(callback, 0);
            };
            GameState.prototype.setMillisecondsToSwitch = function (milliseconds) {
                if (milliseconds < 0) {
                    milliseconds = 0;
                }
                this.millisecondsToSwitch = milliseconds || this.switchTimeout;
                this.millisecondsToSwitchDate = Date.now();
                this.runTimer();
            };
            GameState.prototype.setMapCell = function (x, y, type) {
                if (this.map.cells) {
                    var location = this.map.width * y + x;
                    if (location < this.map.cells.length) {
                        this.map.cells[location] = type;
                    }
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.getTeam = function (id) {
                return this.teams[id];
            };
            GameState.prototype.setTeamRole = function (id, role) {
                var team = this.getTeam(id);
                if (team) {
                    team.role = role;
                    this.callbacks.teamCaptionChanged.fire(team);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.setTeamLives = function (id, lives) {
                var team = this.getTeam(id);
                if (team) {
                    team.lives = lives;
                    this.callbacks.teamLivesChanged.fire(team);
                }
            };
            GameState.prototype.setTeamCoins = function (id, coins) {
                var team = this.getTeam(id);
                if (team) {
                    team.coins = coins;
                    this.callbacks.teamCoinsChanged.fire(team);
                }
            };
            GameState.prototype.setWinners = function (id) {
                this.setStatus(GameApi.GameStatus.finished);
                var team = this.getTeam(id);
                if (team) {
                    team.winner = true;
                    this.callbacks.teamCaptionChanged.fire(team);
                }
            };
            GameState.prototype.getPlayer = function (id) {
                return this.teams && this.teams.team1 && this.teams.team2 ?
                    this.teams.team1.players[id] || this.teams.team2.players[id] : null;
            };
            GameState.prototype.removePlayerFromTeam = function (player, team, disconnected) {
                if (disconnected) {
                    player.connected = false;
                    this.callbacks.playerChanged.fire(player, team);
                }
                else {
                    delete team.players[player.id];
                    this.callbacks.teamPlayersChanged.fire(team);
                }
                this.callbacks.statusChanged.fire(this.status);
                this.callbacks.mapChanged.fire(this.map);
            };
            GameState.prototype.removePlayer = function (id) {
                var disconnected = this.status !== GameApi.GameStatus.open &&
                    this.status !== GameApi.GameStatus.ready;
                var team = this.teams.team1;
                var player = team ? team.players[id] : null;
                if (player) {
                    this.removePlayerFromTeam(player, team, disconnected);
                }
                else {
                    team = this.teams.team2;
                    player = team ? team.players[id] : null;
                    if (player) {
                        this.removePlayerFromTeam(player, team, disconnected);
                    }
                }
            };
            GameState.prototype.addPlayerFromStats = function (teamId, playerStats) {
                var team = this.getTeam(teamId);
                if (team) {
                    var player = createPlayerFromStats(playerStats);
                    team.players[player.id] = player;
                    this.callbacks.statusChanged.fire(this.status);
                    this.callbacks.teamPlayersChanged.fire(team);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.updatePlayerStats = function (id, stats) {
                var player = this.getPlayer(id);
                if (player) {
                    createPlayerFromStats(stats, player);
                    this.callbacks.playerChanged.fire(player);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.movePlayer = function (id, x, y) {
                var player = this.getPlayer(id);
                if (player) {
                    player.x = x;
                    player.y = y;
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.kill = function (id) {
                var player = this.getPlayer(id);
                if (player) {
                    player.alive = false;
                    player.deaths += 1;
                    this.callbacks.playerChanged.fire(player);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.respawn = function (id, x, y) {
                var player = this.getPlayer(id);
                if (player) {
                    player.alive = true;
                    player.x = x;
                    player.y = y;
                    this.callbacks.playerChanged.fire(player);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.addLifeCollected = function (id) {
                var player = this.getPlayer(id);
                if (player) {
                    player.lives += 1;
                    this.callbacks.playerChanged.fire(player);
                }
            };
            GameState.prototype.addCoinCollected = function (id) {
                var player = this.getPlayer(id);
                if (player) {
                    player.coins += 1;
                    this.callbacks.playerChanged.fire(player);
                }
            };
            GameState.prototype.sync = function (syncData) {
                this.name = syncData.game.name;
                this.owner = syncData.game.owner;
                this.status = syncData.game.status;
                this.millisecondsToSwitch = syncData.game.millisecodsToSwitch;
                this.millisecondsToSwitchDate = Date.now();
                this.switchTimeout = syncData.game.switchTimeout;
                this.map = app.utils.unpackMap(syncData.game.map);
                this.teams.team1 = createTeamFromStats(syncData.game.team1Stats);
                this.teams[this.teams.team1.id] = this.teams.team1;
                this.teams.team2 = createTeamFromStats(syncData.game.team2Stats);
                this.teams[this.teams.team2.id] = this.teams.team2;

                //Reconnect if connection was lost
                var selfJoined = this.getPlayer(this.gameApi.questor.user.id);
                if (selfJoined) {
                    this.game.join();
                }

                this.runTimer();

                this.callbacks.captionChanged.fire(this.name, this.status);
                this.callbacks.teamCaptionChanged.fire(this.teams.team1);
                this.callbacks.teamCaptionChanged.fire(this.teams.team2);
                this.callbacks.teamLivesChanged.fire(this.teams.team1);
                this.callbacks.teamLivesChanged.fire(this.teams.team2);
                this.callbacks.teamCoinsChanged.fire(this.teams.team1);
                this.callbacks.teamCoinsChanged.fire(this.teams.team2);
                this.callbacks.teamPlayersChanged.fire(this.teams.team1);
                this.callbacks.teamPlayersChanged.fire(this.teams.team2);
                this.callbacks.mapChanged.fire(this.map);
                this.callbacks.statusChanged.fire(this.status);
                this.callbacks.synced.fire(true);
            };

            return GameState;
        })();
    })(app.game = app.game || {});
})(window.app = window.app || {}, $);

// game.html UI
(function (app, $) {
    (function (game) {
        game.GameView = (function() {
            function getGame() {
                /**
                 * TODO Task1. Объявление переменных и их связка с DOM
                 *  Для получения доступа к DOM элементу следует
                 *  использовать document.getElementById('elementId')
                 *  можно использовать $('selector')
                 * 
                 * (need complete)
                 * 
                 */
                return {
                    // $gameCaption: ,
                    // $switchTimer: ,
                    team1: {
                    //$container: ,
                    $caption: $('#tagteam1'),
                    $players: $('#playersteam1'),
                    $lives: $('#lifeteam1'),
                    $coins: $('#coinsteam1'),
                    },
                     team2: {
                    //$container: ,
                    $caption: $('#tagteam2'),
                    $players: $('#playersteam1'),
                    $lives: $('#lifeteam2'),
                    $coins: $('#coinsteam2'),
                    },
                    // mapBuffer: null,
                    // $mapCanvas: ,
                    // mapCellSize: 25
                };
            }
            function getButtons() {
                // TODO Task1.2 Объявление переменных и их связка с DOM (done)
                return {
                     $btnGameList:$('#BttnList'),
                     $btnStart:$('#BttnStart'),
                     $btnConnect:$('#BttnConnect'),
                     $btnConnectPolice:$('#BttnPolice'),
                     $btnConnectThief:$('#BttnThiefs'),
                     $btnLeave:$('#BttnExit'),
                     $btnPause:$('#BttnPause'),
                     $btnCancel:$('#BttnCancel'),
                };
            }
            function getImages() {
                // TODO Task1.3 Объявление переменных и их связка с DOM (done)
                return {
                    imgHeart:$('#img_heart').get(0),
                    imgCoin:$('#img_coin').get(0),
                    imgPolice: $('#img_police').get(0),
                    imgPoliceSelf: $('#img_police_self').get(0),
                    imgThief: $('#img_thief').get(0),
                    imgThiefSelf: $('#img_thief_self').get(0),
                    imgSwitch: $('#img_switch').get(0),
                };
            }
            function setMapCanvasSizing($canvas, width, height) {
                /**
                 * TODO Task 2. Опишите функцию которая задаст размеры игрового поля
                 */
                return $canvas;
            }
            function drawMapField(canvas, map, width, height, cellSize) {
                var ctx = canvas.getContext("2d");
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, width, height);
                ctx.strokeStyle = "#C0C0C0";
                ctx.strokeWidth = "1px";
                for (var i = 0; i < map.cells.length; i++) {
                    var cell = map.cells[i];
                    var x = i % map.width;
                    var y = Math.floor(i / map.width);
                    if (cell === GameApi.MapCellType.wall) {
                        ctx.fillStyle = "#C0C0C0";
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    }
                    else {
                        ctx.fillStyle = "#FFFFFF";
                        ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
                        ctx.stroke();
                    }
                }
            }
            function getCanvasBuffer(width, height, map, cellSize) {
                var canvas = setMapCanvasSizing($("<canvas/>"), width, height).get(0);
                drawMapField(canvas, map, width, height, cellSize);
                return canvas;
            }
            function getMapCellSize(map) {
                return map.width <= 20 ? 25 : 15;
            }

            function GameView($container, $loading, $error, gameState) {
                this.imgRotationAngle = 0;
                this.imgRotationPeriod = 10;
                this.imgRotationTimer = null;
                this.$container = $container;
                this.$loading = $loading;
                this.$error = $error;
                this.state = gameState;
                this.btns = getButtons();
                this.imgs = getImages();
                this.game = getGame();
                this.bindEvents();
                this.bindButtons();

            }
            GameView.prototype.bindEvents = function () {
                /**
                 * TODO Task 3. Используя addEventListener (или любым другим способом)
                 *              повешайте обработчики событий на кнопки
                 *              нажатия на кнопки это событие click
                 */
                // var c = this.state.callbacks;
                // c.captionChanged
                // c.invalidGame
                // c.mapChanged
                // c.playerChanged
                // c.statusChanged
                // c.synced
                // c.syncing
                // c.teamCaptionChanged
                // c.teamCoinsChanged
                // c.teamLivesChanged
                // c.teamPlayersChanged
                // c.timerChanged
            };
            GameView.prototype.bindButtons = function () {
                // TODO Task 3.1 повешайте обработчики событий
                // var btns = this.btns;
                // var $lastKey = -1;
                // btns.$btnGameList.
                // btns.$btnStart.
                // btns.$btnConnect.
                // btns.$btnConnectPolice.
                // btns.$btnConnectThief.
                // btns.$btnLeave.
                // btns.$btnPause.
                // btns.$btnCancel.
                $(window).on('keydown', function(event) {
                    if ($lastKey === event.keyCode) {
                        return;
                    }
                    /**
                     * TODO Task 4. Вместо event.keyCode начните использовать event.key (done)
                     */
                    switch (event.key) {
                        case Space:
                            event.preventDefault();
                            this.state.game.stopMoving();
                            break;
                        case ArrowLeft:
                            event.preventDefault();
                            this.state.game.beginMove(GameApi.MoveDirection.left);
                            break;
                        case ArrowUp:
                            event.preventDefault();
                            this.state.game.beginMove(GameApi.MoveDirection.top);
                            break;
                        case ArrowRight:
                            event.preventDefault();
                            this.state.game.beginMove(GameApi.MoveDirection.right);
                            break;
                        case ArrowDown:
                            event.preventDefault();
                            this.state.game.beginMove(GameApi.MoveDirection.bottom);
                            break;
                    }
                    //console.log(event);
                }.bind(this));
                $(window).on('keyup', function() {
                    $lastKey = -1;
                }.bind(this));
            };
            GameView.prototype.toggleRotation = function (status) {
                if (status === GameApi.GameStatus.inProcess) {
                    if (!this.imgRotationTimer) {
                        this.imgRotationTimer = setInterval(function (){
                            this.imgRotationAngle += this.imgRotationPeriod;
                            if (this.imgRotationAngle >= 360) {
                                this.imgRotationAngle = 0;
                            }
                            this.updateMap();
                        }.bind(this), 50);
                    }
                } else if (this.imgRotationTimer) {
                    clearInterval(this.imgRotationTimer);
                    this.imgRotationTimer = null;
                }
            };
            GameView.prototype.drawObject = function (ctx, objType, x, y, cellSize) {
                var img = null;
                switch (objType) {
                    case GameApi.MapCellType.coin:
                        img = this.imgs.imgCoin;
                        break;
                    case GameApi.MapCellType.life:
                        img = this.imgs.imgHeart;
                        break;
                    case GameApi.MapCellType.swtch:
                        img = this.imgs.imgSwitch;
                        break;
                }
                if (img) {
                    ctx.drawImage(img, cellSize * x + 2, cellSize * y + 2, cellSize - 4, cellSize - 4);
                }
            };
            GameView.prototype.drawPlayer = function (ctx, playerId, police, x, y, cellSize) {
                var self = this.state.gameApi.questor.user.id === playerId;
                var halfCell = cellSize / 2;
                var img = police ? (self ? this.imgs.imgPoliceSelf : this.imgs.imgPolice) :
                    self ? this.imgs.imgThiefSelf : this.imgs.imgThief;
                ctx.save();

                ctx.translate(x * cellSize + halfCell, y * cellSize + halfCell);
                ctx.rotate(this.imgRotationAngle * Math.PI/180);
                ctx.drawImage(img, 2 - halfCell, 2 - halfCell, cellSize - 4, cellSize - 4);

                ctx.restore();
            };
            GameView.prototype.drawTeam = function (ctx, team, cellSize) {
                var police = team.role === GameApi.GameTeamRole.police;
                $.each(team.players, function (playerId) {
                    var player = team.players[playerId];
                    if (player.alive) {
                        this.drawPlayer(ctx, playerId, police, player.x, player.y, cellSize);
                    }
                }.bind(this));
            };
            GameView.prototype.updateMap = function (map) {
                map = map || this.state.map;
                if (!this.game.mapBuffer) {
                    this.game.mapCellSize = getMapCellSize(map);
                    var width = map.width * this.game.mapCellSize;
                    var height = map.height * this.game.mapCellSize;
                    setMapCanvasSizing(this.game.$mapCanvas, width, height);
                    this.game.mapBuffer = getCanvasBuffer(width, height, map, this.game.mapCellSize);
                }
                var ctx = this.game.$mapCanvas.get(0).getContext("2d");
                var cellSize = this.game.mapCellSize;
                ctx.drawImage(this.game.mapBuffer, 0, 0);
                for (var i = 0; i < map.cells.length; i++) {
                    var cell = map.cells[i];
                    var x = i % map.width;
                    var y = Math.floor(i / map.width);
                    this.drawObject(ctx, cell, x, y, cellSize);
                }
                if (this.state.status !== GameApi.GameStatus.open &&
                    this.state.status !== GameApi.GameStatus.ready) {
                    this.drawTeam(ctx, this.state.teams.team1, cellSize);
                    this.drawTeam(ctx, this.state.teams.team2, cellSize);
                }
            };
            GameView.prototype.setGameCaption = function (name, status) {
                name = name || this.state.name;
                status = status || this.state.status;
                /**
                 * TODO: Task 5. Поменяйте под вашу вёрстку
                 */
                this.game.$gameCaption
                    .empty()
                    .append($(app.utils.t(
                        "<div class='game-caption-name'>{name} <span class='game-caption-status game-caption-status-{status}'>{statusName}</span></div>",
                        {name: name, status: status, statusName: app.utils.getStatusName(status)})));
            };
            GameView.prototype.setTimer = function (data) {
                var seconds = data.s;
                var minutes = data.m;
                var timerState = minutes > 0 || seconds > 30 ? "game-timer-ok" :
                    seconds > 15 ? "game-timer-warn" : "game-timer-cri";
                if (seconds < 10) {
                    seconds = "0" + seconds;
                }
                if (minutes < 10) {
                    minutes = "0" + minutes;
                }
                this.game.$switchTimer
                    .empty()
                    .append(app.utils.t("<span class='{state}'>{m}:{s}</span>",
                        {state: timerState, m: minutes, s: seconds}));
            };
            GameView.prototype.getPlayer = function (player) {
                var status = player.alive ?
                    (player.connected ? "ac" : "ad") :
                    player.connected ? "dc" : "dd";
                /**
                 * TODO: Task 6. Поменяйте под вашу вёрстку
                 */
                return $(app.utils.t(
                    "<div id='player{playerId}' class='game-player game-player-status-{status}'>" +
                        "<span class='game-player-name'>{name}</span>" +
                        " [<span class='game-player-coins'>{coins}</span>;" +
                        "<span class='game-player-lives'>{lives}</span>;" +
                        "<span class='game-player-deaths'>{deaths}</span>]" +
                    "</div>", {
                    playerId: player.id,
                    status: status,
                    name: player.name,
                    coins: player.coins,
                    lives: player.lives,
                    deaths: player.deaths
                }));
            };
            GameView.prototype.updatePlayer = function (player) {
                var $p = $("#player" + player.id);
                $p.replaceWith(this.getPlayer(player));
            };
            GameView.prototype.getTeam = function (team) {
                if (team == this.state.teams.team1) {
                    return this.game.team1;
                }
                return this.game.team2;
            };
            GameView.prototype.setTeamCaption = function (team, $team) {
                if (team.winner) {
                    $team.$container.addClass("game-team-winner");
                }
                var role = team.role === GameApi.GameTeamRole.police ? "police" : "thief";
                $team.$container.removeClass("police");
                $team.$container.removeClass("thief");
                $team.$container.addClass(role);
                /**
                 * TODO: Task 7. Поменяйте под вашу вёрстку
                 */
                $team.$caption
                    .empty()
                    .append(app.utils.t(
                        "<div class='game-team-{role}-caption'>" +
                            "<span class='game-team-name'>{name}</span> " +
                            "<span class='game-team-role game-team-role-{role}'>{roleName}</span>" +
                        "</div>", {
                            role: role,
                            roleName: team.role === GameApi.GameTeamRole.police ? "полиция" : "мошенники",
                            name: team.name
                        }
                    ));
            };
            GameView.prototype.setTeam = function (team, $team) {
                this.setTeamCaption(team, $team);
                $team.$lives.text(team.lives);
                $team.$coins.text(team.coins);
                $team.$players.empty();
                $.each(team.players, function (player) {
                    $team.$players.append(this.getPlayer(team.players[player]));
                }.bind(this));
            };
            GameView.prototype.updateTeam = function (team) {
                var $team = this.getTeam(team);
                this.setTeam(team, $team);
            };
            GameView.prototype.updateTeamCaption = function (team) {
                var $team = this.getTeam(team);
                this.setTeamCaption(team, $team);
            };
            GameView.prototype.updateTeamLives = function (team) {
                var $team = this.getTeam(team);
                $team.$lives.text(team.lives);
            };
            GameView.prototype.updateTeamCoins = function (team) {
                var $team = this.getTeam(team);
                $team.$coins.text(team.coins);
            };
            GameView.prototype.setButtons = function (status) {
                /**
                 * TODO: Task 8. Проинициализируйте состояние кнопок для владельца игры и администратора
                 *    с учётом текущего статуса игры
                 *    для добавление класса можно использовать utils.addClasses($el,'hidden')
                 *    для удаления класса можно использовать utils.removeClasses($el,'hidden')
                 *
                 *    this.state.status - текущий статус игры
                 *    GameApi.GameStatus - имеющиеся статусы
                 *    this.state.gameApi.questor.user - сведения о пользователе
                 *    this.state.owner - сведения о вледельце игры
                 *    this.state.getPlayer(currentUserId) - пользователь в игре?
                 *    this.btns - кнопки тут
                 */
            };
            GameView.prototype.showLoading = function () {
                /**
                 * TODO: Task 9. Опишите доступность элементов при загрузке игры $container $error $loading
                 */
            };
            GameView.prototype.showError = function () {
                /**
                 * TODO: Task 10. Опишите доступность элементов при загрузке игры $container $error $loading
                 */
            };
            GameView.prototype.show = function () {
                /**
                 * TODO: Task 11. Опишите доступность элементов при загрузке игры $container $error $loading
                 */
            };

            return GameView;
        })();
    })(app.game = app.game || {});
})(window.app = window.app || {}, $);

/**
 * TODO: Task 12. (Дополнительно) Обработайте ошибки которые могут быть при нажатии на кнопки
 *      для показа сообщения можно использовать alert
 *      можно попробовать сделать это используя модальные окна, только если игра уже работает
 *      https://getbootstrap.com/docs/3.3/javascript/#modals
 */
