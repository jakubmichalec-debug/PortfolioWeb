// Browser interpretation of the Shot Dispenser sketch (site/assets/code/shot-dispenser.ino).
// A tap becomes the same sequence of outputs the Arduino produces: LCD text, LEDs, buzzer, pump, with the sketch's delays.
export const PRICE = 6;
export const TAGS = Object.freeze({
  a: { uid: '6CF34403', label: 'Bracelet A' },
  b: { uid: '5EEC4403', label: 'Bracelet B' },
  unknown: { uid: 'A1B2C3D4', label: 'Unknown tag' }
});
export const START_BALANCE = Object.freeze({ a: 15, b: 5 });
export const LOOP_DELAY = 5000; // loop(): the reader is only checked once every 5 seconds

const beeps = (count, state) => Array.from({ length: count }, () => [{ ...state, tone: 1000, ms: 300 }, { ...state, tone: 0, ms: 300 }]).flat();

export class Dispenser {
  constructor() { this.reset(); }
  reset() { this.balance = { ...START_BALANCE }; this.water = true; this.log = ['System Ready!']; }

  // What WaterLevelCheck() leaves on the outputs between taps.
  idle() {
    return this.water
      ? { lcd: ['Welcome! Please', 'scan bracelet'], red: false, green: true, pump: false, tone: 0 }
      : { lcd: ['Water Low!', 'Refill required'], red: true, green: false, pump: false, tone: 0 };
  }

  // Steps the outputs go through after a tap. Each step holds for `ms` milliseconds; the last one stays.
  scan(key) {
    const off = { red: false, green: false, pump: false, tone: 0 };
    if (!this.water) {
      // The sketch never reads the card while the sensor reports LOW: it only repeats the warning.
      this.log.push('Water Low! Refill required');
      const low = { lcd: ['Water Low!', 'Refill required'], ...off, red: true };
      return { outcome: 'water-low', steps: [...beeps(3, low), { ...low, ms: 0 }] };
    }
    const tag = TAGS[key];
    this.log.push('Scanning NFC Tag...', `UID: ${tag.uid}`);
    const welcome = { lcd: ['Welcome!', 'Scan bracelet'], ...off, green: true, ms: 0 };
    if (!(key in this.balance)) {
      return { outcome: 'unknown', steps: [{ lcd: ['Unknown Tag', 'Access Denied'], ...off, green: true, ms: 5000 }, { ...this.idle(), ms: 0 }] };
    }
    this.log.push(`Balance: ${this.balance[key]}`);
    if (this.balance[key] >= PRICE) {
      this.balance[key] -= PRICE;
      const lcd = ['Pouring...', `New balance: ${this.balance[key]}`];
      const steps = [{ lcd, ...off, green: true, ms: 1000 }];
      for (let i = 0; i < 5; i++) steps.push({ lcd, ...off, pump: true, green: true, ms: 500 }, { lcd, ...off, pump: true, ms: 500 });
      steps.push({ lcd, ...off, ms: 2000 }, { lcd: ['Enjoy!', ''], ...off, ms: 3000 }, { ...welcome, green: false });
      return { outcome: 'poured', steps };
    }
    const lcd = ['Not enough funds', `Balance: ${this.balance[key]}`];
    const steps = beeps(3, { lcd, ...off, green: true });
    for (let i = 0; i < 4; i++) steps.push({ lcd, ...off, red: true, ms: 500 }, { lcd, ...off, ms: 500 });
    steps.push({ ...welcome, green: false });
    return { outcome: 'declined', steps };
  }
}

export const duration = steps => steps.reduce((total, step) => total + step.ms, 0);
export const pumpTime = steps => steps.filter(step => step.pump).reduce((total, step) => total + step.ms, 0);
