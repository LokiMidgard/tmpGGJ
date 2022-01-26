import { Actor, Font, Text, vec } from "excalibur";
import { Resources } from "./resources";

export class Player extends Actor {

  private _user: string;
  public get user(): string {
    return this._user;
  }
  public set user(v: string) {
    this._user = v;
  }

  constructor(user: string) {
    super({
      pos: vec(150, 150),
      width: 25,
      height: 25,
    });
    this._user = user;

  }


  onInitialize() {
    this.graphics.use(Resources.Sword.toSprite());

    const text = new Text({
      text: `User: ${this._user}`,
      font: new Font({ size: 25 })
    })
     this.graphics.add(text);
  }
}
