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


type Handlers = {
  [S in CommunicationEvents]?: EventHandler<S>[]
}


type CommunicationEvents = 'AddPlayer' | 'RemovePlayer' | 'NewTurn';
type EventArguments<E extends CommunicationEvents> =
  E extends 'AddPlayer' ? { player: Player }
  : E extends 'RemovePlayer' ? { player: Player }
  : E extends 'NewTurn' ? {
    moves: ({ player: Player } & Move)[]
  }
  : never;
type EventHandler<E extends CommunicationEvents> = (event: EventArguments<E>) => void;

class Communication {
  private readonly socket = ioclient();
  private readonly userData: UserData
  private readonly players: Record<string, Player> = {};
  private moves: Record<string, Move & { player: Player }> = {};
  private readonly userPlayer: Player;
  private readonly handlers: Handlers = {};

  private readonly createPlayer: (userData: UserData) => Player;

  constructor(userData: UserData, userPlayer: Player, createPlayer: (userData: UserData) => Player) {
    this.userData = userData;
    this.userPlayer = userPlayer;
    this.createPlayer = createPlayer;
    this.socket.on('join', data => this.handleJoin(data))
    this.socket.on('left', data => this.handleLeve(data))
    this.socket.on('move', data => this.handleMove(data))
    this.send('join', userData);
  }
  private handleJoin(data: Join & UserData) {
    console.log("recived Join", data);
    console.log("recived Join log me", this);
    if (!this.players[data.user] && data.user != this.userData.user) {
      console.log(`Player ${data.user} joind`)
      const newPlayer = this.createPlayer(data);
      this.players[data.user] = newPlayer;
      this.socket.emit('join', this.userData);
      const handlers = this.handlers.AddPlayer;
      if (handlers) {
        for (let index = 0; index < handlers.length; index++) {
          const handler = handlers[index];
          handler({ player: newPlayer });
        }
      }
    }
  }

  private handleLeve(data: Join & UserData) {
    console.log("recived left", data);
    if (this.players[data.user] && data.user != this.userData.user) {

      const oldPlayer = this.players[data.user];

      const handlers = this.handlers.RemovePlayer;
      if (handlers) {
        for (let index = 0; index < handlers.length; index++) {
          const handler = handlers[index];
          handler({ player: oldPlayer });
        }
      }
    }
  }

  private handleMove(data: Move & UserData) {
    if (!this.moves[data.user] && data.user != this.userData.user) {
      console.log(`Player ${data.user} moved`)

      this.moves[data.user] = { ...data, player: this.players[data.user] };

      // test if we have all moves including our own
      this.CheckAllMoved();


    }
  }

  private CheckAllMoved() {
    if (Object.keys(this.moves).length == Object.keys(this.players).length + 1) {
      const handlers = this.handlers.NewTurn;
      if (handlers) {
        console.log('All Moves are present');
        for (let index = 0; index < handlers.length; index++) {
          const handler = handlers[index];
          const moveArray = Object.keys(this.moves).map(k => this.moves[k]);
          handler({ moves: moveArray });
          this.moves = {};
        }
      }
    }
  }

  public SubmitMove(data: Move) {
    console.log('try submit move Move');
    if (!this.moves[this.userData.user]) {
      console.log('Submitting Move');
      this.moves[this.userData.user] = { ...data, player: this.userPlayer };
      this.send('move', data);
      this.CheckAllMoved();

    }
  }

  public register<E extends CommunicationEvents>(event: E, handler: EventHandler<E>) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    const h = this.handlers[event] as EventHandler<E>[];
    h.push(handler);
  }

  private send<T extends object>(message: string, data: T) {
    this.socket.emit(message, { ...this.userData, ...data });
  }





}

class Game extends Engine {
  initialize() {


    const userName = Math.random().toString();

    const player = new Player(userName);
    this.add(player);

    const joinData: UserData = {
      user: userName,
      room: location.search ?? 'myRoom'
    };
    const communication = new Communication(joinData, player, data => new Player(data.user));

    communication.register('AddPlayer', data => {
      this.add(data.player);
    })
    communication.register('RemovePlayer', data => {
      console.log('Remove player')
      this.remove(data.player)
    })


    communication.register('NewTurn', data => {

      for (let index = 0; index < data.moves.length; index++) {
        const move = data.moves[index];
        move.player.pos.x = move.x;
        move.player.pos.y = move.y;
      }

    })


    const loader = new Loader();
    loader.addResource(Resources.Sword);
    this.start(loader).then(() => {
      console.log(EX_VERSION);
    });

    this.on('preupdate', e => {
      const keys = this.input.keyboard.getKeys();
      const speed = 20;
      let didMove = false;
      const targetPost = { x: player.pos.x, y: player.pos.y };

      if (keys.includes(Input.Keys.ArrowRight)) {
        targetPost.x = player.pos.x + speed;
        didMove = true;
      }
      if (keys.includes(Input.Keys.ArrowLeft)) {
        targetPost.x = player.pos.x - speed;
        didMove = true;
      }
      if (keys.includes(Input.Keys.ArrowDown)) {
        targetPost.y = player.pos.y + speed;
        didMove = true;
      }
      if (keys.includes(Input.Keys.ArrowUp)) {
        targetPost.y = player.pos.y - speed;
        didMove = true;
      }
      if (didMove) {
        communication.SubmitMove(
          targetPost
        )

      }
    })


  }
}

const game = new Game();


game.initialize();

