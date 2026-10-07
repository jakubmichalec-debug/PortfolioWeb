// Browser interpretation of the archived fusion_project_final sketch.
// Geometry and sample descriptions are illustrative, not measured CAD.
export const TAGS = Object.freeze({ staff: 'D34611DA', owner: '538CC9D9', other: '77C01C2F', unknown: 'DEADBEEF', wallet: 'B180BD02', keys: '3D801C2F' });

export class LockerEngine {
  constructor({ guided = true } = {}) { this.guided = guided; this.reset(); }
  reset(scenario = 'claim') {
    this.scenario = scenario;
    this.items = scenario === 'store' && this.guided ? [] : [{ tag: TAGS.wallet, owner: TAGS.owner, description: 'Wallet', id: 1 }, { tag: TAGS.keys, owner: TAGS.owner, description: 'Keys', id: 2 }];
    this.physicalItems = [...this.items]; this.heldItems = []; this.transferred = false; this.nextId = 3;
    this.phase = 'ready'; this.elapsed = 0; this.duration = 0; this.servo = 90;
    this.green = false; this.red = false; this.doorOpen = false; this.pendingTag = null;
    this.pendingItem = null; this.action = null; this.listIndex = 0; this.listTime = 0;
    this.lcd = ['Locker Ready', '']; this.code = 'read-tag'; this.lastTag = '—'; this.beep = null;
    this.message = scenario === 'store' ? 'Start with the staff card. Then tag, describe and place the found item inside.' : 'Your wallet is inside. Scan the matching personal card, then open the door to collect it.';
    this.events = [scenario === 'store' ? 'Storage scenario · empty locker' : 'Collection scenario · Wallet and Keys inside'];
  }
  get canScan() { return this.phase === 'ready' || this.phase === 'listing' || this.phase === 'await-tag'; }
  get busy() { return !this.canScan && this.phase !== 'await-description'; }
  get canOpenDoor() { return !this.doorOpen && this.servo === 0 && (!this.guided || this.phase === 'unlocked'); }
  get canCloseDoor() { return this.doorOpen && (!this.guided || this.transferred && this.phase === 'close-door'); }
  get canTransfer() { return this.guided && this.doorOpen && this.phase === 'transfer' && !this.transferred; }
  log(text) { this.events.unshift(text); this.events = this.events.slice(0, 5); }
  wait(phase, duration) { this.phase = phase; this.elapsed = 0; this.duration = duration; }
  scan(tag) {
    if (!this.canScan) return false;
    this.lastTag = tag; this.beep = null; this.log(`RFID → ${tag}`);
    if (this.phase === 'await-tag') {
      if (this.guided && ![TAGS.wallet, TAGS.keys].includes(tag)) {
        this.message = 'Choose a Wallet or Keys item tag below. A personal card is not an item tag in this guided exercise.'; return false;
      }
      if (this.guided && this.items.some(item => item.tag === tag)) {
        this.message = 'That item is already inside. Choose the other tag, or restart the storage scenario.'; return false;
      }
      this.pendingTag = tag; this.phase = 'await-description'; this.lcd = ['Register Item', '']; this.code = 'registration';
      this.message = 'Type a short item description below, then press Save description. This represents the Arduino Serial Monitor.';
    } else if (tag === TAGS.staff) {
      if (this.guided && this.scenario !== 'store') { this.message = 'Choose “Store a found item” to start the staff-registration walkthrough.'; return false; }
      this.wait('master-on', 2); this.lcd = ['Master Mode On', '']; this.code = 'registration'; this.beep = 1000;
      this.message = 'Staff mode starts. After the 2-second delay, scan an item tag.';
      if (this.guided) { this.wait('await-tag', 0); this.lcd = ['Scan item tag', '']; this.message = 'Staff access accepted. Choose the Wallet or Keys item tag below.'; }
    } else if (tag === TAGS.owner || tag === TAGS.other) {
      if (!this.items.length) {
        this.wait('empty', 3); this.lcd = ['No Items', '']; this.code = 'owner-match';
        this.message = 'The item list is empty. The sketch does not unlock the locker.';
      } else {
        const match = this.items.find(item => item.owner === tag);
        if (match) {
          this.pendingItem = match; this.lcd = ['Item ID: ', match.tag];
          this.unlock('claim'); this.message = this.guided ? `Card accepted. The yellow latch has rotated clear. Open the door to collect ${match.description}.` : 'Owner matched. The servo releases the latch for 8 seconds. Open the door by hand.';
        } else {
          this.wait('no-match', 3); this.lcd = ['No Items Found', '']; this.code = 'owner-match'; this.beep = 500;
          this.message = 'This card is recognised, but none of the stored records belong to it. No unlock and no red flash.';
        }
      }
    } else {
      this.wait('denied', 6); this.lcd = ['Access Denied', '']; this.code = 'access-denied'; this.beep = 500; this.red = true;
      this.message = 'Unknown card. The red LED flashes 3 times, followed by a 3-second delay. The latch stays locked.';
    }
    return true;
  }
  register(description) {
    if (this.phase !== 'await-description') return false;
    if (this.guided && !description.trim()) { this.message = 'Give the item a name first—for example “Wallet”—so a visitor knows what to collect.'; return false; }
    if (this.items.length >= 10) {
      this.message = 'Preview safety limit: 10 records. The original sketch has no array-capacity guard; reset the demo to continue.';
      return false;
    }
    const item = { tag: this.pendingTag, owner: TAGS.owner, description: description.trim(), id: this.nextId++ };
    this.items.push(item); this.pendingItem = item; this.lcd = ['Item Registered', '']; this.unlock('register');
    if (this.guided) this.heldItems = [item];
    this.message = this.guided ? `${item.description} is registered, but still outside the box. Open the door next.` : 'Record stored. Your sketch assigns every registered item to personal card A. Open the door to illustrate storage.';
    this.log(`Registered ${item.description || '(blank)'} → owner A`); return true;
  }
  unlock(action) {
    this.action = action; this.transferred = false; this.wait('unlocked', this.guided ? 0 : 8); this.servo = 0; this.green = true; this.red = false;
    this.code = 'servo-and-feedback'; this.beep = 1000; this.log('Servo → 0° · green LED on');
  }
  toggleDoor() {
    if (this.guided) {
      if (!this.doorOpen) {
        if (!this.canOpenDoor) { this.message = 'Scan the correct card and finish registration, if needed, before opening the door.'; return false; }
        this.doorOpen = true; this.wait('opening', 1);
        this.message = 'The latch is clear. Wait for the door to finish opening before moving the item.';
        this.log('Door opened by hand'); return true;
      }
      if (!this.canCloseDoor) { this.message = this.action === 'claim' ? `Take ${this.pendingItem.description} out before closing the door.` : `Put ${this.pendingItem.description} inside before closing the door.`; return false; }
      this.doorOpen = false; this.wait('closing', 1);
      this.message = 'The door is closing. The latch will lock after the door reaches its closed position.';
      this.log('Closing door before moving latch'); return true;
    }
    if (!this.doorOpen && this.servo !== 0) {
      this.message = 'The latch is locked. Scan the matching card, or register an item with the staff card, before opening.';
      return false;
    }
    this.doorOpen = !this.doorOpen;
    this.log(this.doorOpen ? 'Door opened by hand (illustration)' : 'Door closed by hand (illustration)'); return true;
  }
  transferItem() {
    if (!this.canTransfer) { this.message = this.doorOpen ? 'This item step is already complete.' : 'Open the unlocked door before moving the item.'; return false; }
    if (this.action === 'claim' && !this.physicalItems.some(item => item.id === this.pendingItem.id)) return false;
    this.wait('moving-item', .7);
    this.message = this.action === 'claim' ? `Taking ${this.pendingItem.description} out…` : `Placing ${this.pendingItem.description} inside…`;
    return true;
  }
  continueCollection() {
    if (this.phase !== 'complete' || this.scenario !== 'claim' || !this.items.length) return false;
    this.pendingItem = null; this.action = null; this.transferred = false; this.heldItems = []; this.idle();
    this.message = 'Scan your personal card again to collect the next stored item.'; return true;
  }
  idle(list = true) {
    this.wait(list && this.items.length ? 'listing' : 'ready', 0);
    this.listIndex = 0; this.listTime = 0; this.lcd = [this.phase === 'listing' ? this.items[0].description : 'Locker Ready', ''];
    this.code = this.phase === 'listing' ? 'display-cycle' : 'read-tag';
  }
  tick(seconds) {
    if (!(seconds >= 0)) return;
    if (this.phase === 'listing') {
      this.listTime += seconds;
      while (this.listTime >= 3) { this.listTime -= 3; this.listIndex = (this.listIndex + 1) % this.items.length; }
      this.lcd = [this.items[this.listIndex].description, '']; return;
    }
    if (!this.duration) return;
    const step = Math.min(seconds, this.duration - this.elapsed);
    this.elapsed += step;
    if (this.phase === 'denied') this.red = this.elapsed < 3 && Math.floor(this.elapsed * 2) % 2 === 0;
    if (this.elapsed + 0.00001 < this.duration) return;
    const phase = this.phase;
    if (phase === 'opening') {
      this.wait('transfer', 0);
      this.message = this.action === 'claim' ? `Now take ${this.pendingItem.description} out. The door cannot close until you collect it.` : `Now put ${this.pendingItem.description} inside. The door cannot close while the item is still outside.`;
    } else if (phase === 'moving-item') {
      if (this.action === 'claim') {
        this.physicalItems = this.physicalItems.filter(item => item.id !== this.pendingItem.id); this.heldItems = [this.pendingItem];
        this.log(`${this.pendingItem.description} taken out`);
      } else { this.physicalItems.push(this.pendingItem); this.heldItems = []; this.log(`${this.pendingItem.description} placed inside`); }
      this.transferred = true; this.wait('close-door', 0);
      this.message = this.action === 'claim' ? `${this.pendingItem.description} is now in your hand. Close the door to finish.` : `${this.pendingItem.description} is now inside the locker. Close the door to finish.`;
    } else if (phase === 'closing') {
      this.servo = 90; this.green = false;
      if (this.action === 'claim') this.items = this.items.filter(item => item.id !== this.pendingItem.id);
      this.wait('complete', 0); this.lcd = [this.action === 'claim' ? 'Item collected' : 'Item stored', this.pendingItem.description];
      this.message = this.action === 'claim' ? `${this.pendingItem.description} collected. The door is closed and the latch is locked. You completed every step.` : `${this.pendingItem.description} is inside. The door is closed and the latch is locked. Registration is complete.`;
      this.log('Door closed → latch locked at 90°');
    } else if (phase === 'master-on') {
      this.wait('await-tag', 0); this.lcd = ['', '']; this.message = 'Staff mode: scan an item tag. The real LCD is blank here; the prompt is in Serial Monitor.';
    } else if (phase === 'unlocked') {
      this.servo = 90; this.green = false; this.log('Servo → 90° · green LED off');
      if (this.action === 'claim') {
        this.items.splice(this.items.indexOf(this.pendingItem), 1); this.log('Matching record removed from RAM');
        this.idle(); this.message = '8 seconds elapsed. The code removes the matching record; it does not sense whether the item was collected.';
      } else {
        this.wait('registered-description', 3); this.lcd = ['Item Registered', this.pendingItem.description];
        this.code = 'registration'; this.message = 'The lock window is over. The entered description is displayed for 3 seconds.';
      }
      if (this.doorOpen) this.message += ' The door is still open: close it by hand. There is no door sensor in the sketch.';
    } else if (phase === 'registered-description') {
      this.wait('master-off', 2); this.lcd = ['Master Mode Off', '']; this.code = 'registration';
      this.message = 'Staff mode ends; then the LCD cycles stored descriptions every 3 seconds.';
    } else if (phase === 'empty') {
      this.wait('empty-ready', 2); this.lcd = ['Locker Ready', '']; this.beep = 500;
    } else if (phase === 'denied') {
      this.red = false; this.idle(false); this.message = 'Unknown card rejected. Try the matching personal card.';
    } else { this.idle(); this.message = 'Ready for another card. Stored descriptions cycle on the LCD.'; }
    if (seconds - step > 0.00001) this.tick(seconds - step);
  }
  skipDelay() { if (this.guided && ['closing','opening','moving-item'].includes(this.phase)) return false; if (this.duration) { this.tick(this.duration - this.elapsed); return true; } return false; }
}
