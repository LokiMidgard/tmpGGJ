import { Engine, EX_VERSION, Loader, Input } from "excalibur";
import { Player } from "./player";
import { Resources } from "./resources";
import ioclient, { io } from "socket.io-client";




type UserData = {
  room: string;
  user: string;
}

type Join = {

}

type Move = {

  x: number;
  y: number;
};

type GameState = {
  positions: Record<string, { position: { x: number, y: number } }>
}


type Handlers = {
  [S in CommunicationEvents]?: EventHandler<S>[]
}


type CommunicationEvents = 'AddPlayer' | 'RemovePlayer' | 'NewTurn' | 'RecivedGameState';
type EventArguments<E extends CommunicationEvents> =
  E extends 'AddPlayer' ? { player: string }
  : E extends 'RemovePlayer' ? { player: string }
  : E extends 'RecivedGameState' ? { state: GameState }
  : E extends 'NewTurn' ? {
    moves: ({ player: string } & Move)[]
  }
  : never;
type EventHandler<E extends CommunicationEvents> = (event: EventArguments<E>) => void;

class Communication {
  private readonly socket = ioclient();
  private readonly userData: UserData
  private moves: Record<string, Move | undefined> = {};
  private readonly handlers: Handlers = {};

  private readonly getGameState: () => GameState;
  private readonly requestPlayerNumber: () => number;
  private readonly isPlayerKnown: (playerName: string) => boolean;

  constructor(userData: UserData, requestGameState: () => GameState, getPlayerNumber: () => number, isPlayerKnown: (playerName: string) => boolean) {
    this.userData = userData;
    this.getGameState = requestGameState;
    this.requestPlayerNumber = getPlayerNumber;
    this.isPlayerKnown = isPlayerKnown;

    this.socket.on('join', data => this.handleJoin(data))
    this.socket.on('left', data => this.handleLeve(data))
    this.socket.on('move', data => this.handleMove(data))
    this.socket.on('gameState', data => this.handleGameState(data))
    this.socket.on('requestGameState', data => this.handleRequestGameState(data))
    this.send('join', userData);
  }

  public submitMove(data: Move) {
    console.debug('try submit move Move');
    if (!this.moves[this.userData.user]) {
      console.debug('Submitting Move');
      this.moves[this.userData.user] = data;
      this.send('move', data);
      this.CheckAllMoved();

    }
  }

  public requestGameState() {
    this.send('requestGameState', {})
  }

  public register<E extends CommunicationEvents>(event: E, handler: EventHandler<E>) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    const h = this.handlers[event] as EventHandler<E>[];
    h.push(handler);
  }

  private handleRequestGameState(data: any): void {
    this.send('gameState', this.getGameState());
  }
  private handleGameState(data: GameState & UserData): void {
    const handlers = this.handlers.RecivedGameState;
    if (handlers) {
      for (let index = 0; index < handlers.length; index++) {
        const handler = handlers[index];
        handler({ state: data });
      }
    }
  }
  private handleJoin(data: Join & UserData) {
    console.debug("recived Join", data);

    if (!this.isPlayerKnown(data.user)) {

      console.debug(`Player ${data.user} joind`)
      this.send('join', this.userData);
      this.send('gameState', this.getGameState());
      const handlers = this.handlers.AddPlayer;
      if (handlers) {
        for (let index = 0; index < handlers.length; index++) {
          const handler = handlers[index];
          handler({ player: data.user });
        }
      }
    }
  }

  private handleLeve(data: Join & UserData) {
    console.debug("recived left", data);
    if (this.isPlayerKnown(data.user)) {
      const handlers = this.handlers.RemovePlayer;
      if (handlers) {
        for (let index = 0; index < handlers.length; index++) {
          const handler = handlers[index];
          handler({ player: data.user });
        }
      }
      delete this.moves[data.user];
      this.CheckAllMoved();
    }
  }

  private handleMove(data: Move & UserData) {

    if (!this.moves[data.user] && this.isPlayerKnown(data.user)) {
      console.debug(`Player ${data.user} moved`)


      this.moves[data.user] = data;

      // test if we have all moves including our own
      this.CheckAllMoved();


    }
  }

  private CheckAllMoved() {
    console.debug("check moves", this.moves);
    const numberOfPlayers = this.requestPlayerNumber();
    console.debug("check moves player count", numberOfPlayers);
    if (Object.keys(this.moves).length == numberOfPlayers) {
      console.debug('All Moves are present');
      const handlers = this.handlers.NewTurn;
      if (handlers) {
        for (let index = 0; index < handlers.length; index++) {
          const handler = handlers[index];
          const moveArray = Object.keys(this.moves).filter(k => this.moves[k]).map(k => ({ ...this.moves[k]!, player: k }));
          handler({ moves: moveArray });
        }
      }
      this.moves = {};
    }
  }



  private send<T extends object>(message: string, data: T) {
    this.socket.emit(message, { ...this.userData, ...data });
  }





}

class Game extends Engine {

  private players: Record<string, Player | undefined> = {};

  private userData: UserData;
  private player: Player;
  /**
   * getPlayer
   */
  public getPlayer(userName: string): Player | undefined {
    if (userName == this.userData.user)
      return this.player;
    return this.players[userName];
  }

  /**
   * getPlaye:Player[]rs
   */
  public getPlayers(): Player[] {
    return Object.values(this.players) as Player[];
  }

  /**
   *
   */
  constructor() {
    super();
    const randomName = Math.random().toString();

    const nameRegex = /user=(?<value>[^&]*)/
    const roomRegex = /room=(?<value>[^&]*)/
    const name = nameRegex.exec(location.search)?.groups!['value'];
    const room = roomRegex.exec(location.search)?.groups!['value'];



    this.userData = {
      user: name ?? randomName,
      room: room ?? 'MyRoom'
    };
    this.player = this.createPlayerForUser(this.userData.user);
  }

  initialize() {



    // this.add(this.player);


    const loader = new Loader();
    loader.addResource(Resources.Sword);
    this.start(loader).then(() => {
      console.log(EX_VERSION);


      const communication = new Communication(this.userData, () => {
        const state: GameState = {
          positions: {}
        };

        for (const player of this.getPlayers()) {
          state.positions[player.user] =
          {
            position: {
              x: player.pos.x,
              y: player.pos.y
            }
          }
        };
        // .reduce((p,v)=>{},state.positions)

        return state;
      },
        () => this.getPlayers().length,
        (playerName) => this.players[playerName] != undefined);



      communication.register('AddPlayer', data => {
        this.createPlayerForUser(data.player);
      })
      communication.register('RemovePlayer', data => {
        console.debug('Remove player', data)
        const player = this.players[data.player];
        if (player) {
          this.remove(player)
          delete this.players[data.player];
        }
      })


      communication.register('NewTurn', data => {
        console.debug('Recived New Turn', data)
        for (let index = 0; index < data.moves.length; index++) {

          const move = data.moves[index];
          const player = this.getPlayer(move.player) ?? this.createPlayerForUser(move.player);
          player.pos.x = move.x;
          player.pos.y = move.y;
        }
      })

      communication.register('RecivedGameState', data => {
        console.debug('Recived Game State', data)
        const playerNames = Object.keys(data.state.positions);
        for (let index = 0; index < playerNames.length; index++) {
          const playerName = playerNames[index];
          const postition = data.state.positions[playerName].position;
          const player = this.players[playerName] ?? this.createPlayerForUser(playerName);
          player.pos.x = postition.x;
          player.pos.y = postition.y;
        }

      })

      communication.requestGameState();

      this.on('preupdate', e => {
        const keys = this.input.keyboard.getKeys();
        const speed = 20;
        let didMove = false;
        const targetPost = { x: this.player.pos.x, y: this.player.pos.y };

        if (keys.includes(Input.Keys.ArrowRight)) {
          targetPost.x = this.player.pos.x + speed;
          didMove = true;
        }
        if (keys.includes(Input.Keys.ArrowLeft)) {
          targetPost.x = this.player.pos.x - speed;
          didMove = true;
        }
        if (keys.includes(Input.Keys.ArrowDown)) {
          targetPost.y = this.player.pos.y + speed;
          didMove = true;
        }
        if (keys.includes(Input.Keys.ArrowUp)) {
          targetPost.y = this.player.pos.y - speed;
          didMove = true;
        }
        if (didMove) {
          communication.submitMove(
            targetPost
          )

        }
      })

    });

  }

  private createPlayerForUser(playerName: string) {
    const player = new Player(playerName);
    this.players[playerName] = player;
    this.add(player);
    console.log(`Created player ${playerName}`)
    return player;
  }
}

const game = new Game();


game.initialize();

