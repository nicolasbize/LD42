(function() {

  // utility functions
  function minToTime(mins, noPrefix) {
    let hours = Math.floor(mins / 60);
    let remnant = mins % 60;
    let txt = "";
    const am = hours < 12;
    if (hours > 12) {
      hours -= 12;
    }
    if (hours < 10 && !noPrefix) {
      txt = "0";
    }
    txt += hours + ":";
    if (remnant < 10) {
      txt += "0";
    }
    txt += remnant;
    txt += am ? "AM" : "PM"
    return txt;
  }

  // return an integer within [min,max]
  function random(min, max) {
    return min + Math.floor(Math.random() * (max+1-min));
  }

  function makeCar(sprIndex, timeArrival, timePickup) {
    return {
      sprIndex: sprIndex,
      timeArrival: timeArrival,
      timePickup: timePickup,
      npcSprIndex: random(0, NB_NPC_TYPES-1),
      width: carSizes[sprIndex].w,
      height: carSizes[sprIndex].h,
      isNPC: true,
      readyForPickup: false,
    }
  }

  const CAR_FRICTION = 0.97;
  const CAR_MAX_VELOCITY = 300;
  const HUMAN_MAX_VELOCITY = 200;
  const NB_NPC_TYPES = 6;
  const NB_CAR_TYPES = 8;
  const TIME_GET_IMPATIENT = 10;
  const TIME_GET_FRUSTRATED = 20;
  const TIME_GET_MAD = 30;
  const TINT_NONE = 0xffffff;
  const TINT_SUCCESS = 0x99e550;
  const TINT_WARNING = 0xfbf236;

  let wallGroup, npcCarGroup, npcGroup, uiGroup, playerGroup;
  let player, cursors, currentCar, deliveryZone;
  let music;
  let sndMoney, sndDoorOpen, sndDoorClose, sndWaiting, sndSteps, sndCar;
  let inCar = false;
  let gettingInCar = false;
  let money = 0, time = 13 * 60;
  let actualMoney = 0;
  let textCurrentMoney, textTime;
  let cars = [];
  let timer = 0;
  let carReadyForCustomer = false;
  let currentLevel = 0;
  const timeSpeed = 60; // the bigger the slower
  const npcStopY = 260;
  let waitingNpc = null; // waiting with speechbubble for time
  let pendingCustomers = [];
  let leavingCars = [];
  let arrow, arrowTimer = 0, arrowDir = 1;
  let platformTimer = 0;
  let canPlayCarSound = false;
  let isPrevLevelGoodPerf = null;

  const carSizes = [
    {w: 130, h: 78},
    {w: 130, h: 78},
    {w: 130, h: 78},
    {w: 180, h: 96},
    {w: 180, h: 90},
    {w: 130, h: 78},
    {w: 130, h: 78},
    {w: 130, h: 78},
  ]

  let levelCars = [[
    makeCar(0, 13*60+5, 13*60+15),
    makeCar(1, 13*60+20, 13*60+30),
    makeCar(2, 13*60+35, 13*60+45),
    makeCar(3, 13*60+45, 15*60+20),
    makeCar(4, 14*60, 18*60),
    makeCar(1, 14*60+15, 16*60+10),
    makeCar(2, 14*60+30, 16*60),
    makeCar(6, 14*60+45, 17*60),
    makeCar(7, 15*60, 16*60+30),
    makeCar(0, 15*60+10, 17*60+20),
    makeCar(0, 15*60+20, 17*60+30),
    makeCar(5, 15*60+35, 17*60+30),
    makeCar(3, 15*60+50, 18*60+15),
    makeCar(6, 16*60+5, 17*60),
  ]];
  let npcCars = [];

  /******
   * GAME SCENE
   ******/
  const gameScene = new Phaser.Scene('Game');

  // LOADING ASSETS
  gameScene.preload = function() {
    this.load.image('background', 'assets/backgrounds/main.png');
    this.load.image('wall-left-top',
      'assets/backgrounds/wall-left-top.png');
    this.load.image('wall-left-bottom',
      'assets/backgrounds/wall-left-bottom.png');
    this.load.image('wall-bottom',
      'assets/backgrounds/wall-bottom.png');
    this.load.image('wall-right',
      'assets/backgrounds/wall-right.png');
    this.load.image('booth',
      'assets/backgrounds/booth.png');

    this.load.audio('sndMoney',
      ['assets/sounds/money.mp3', 'assets/sounds/money.ogg']);
    this.load.audio('sndDoorOpen',
      ['assets/sounds/door-open.mp3', 'assets/sounds/door-open.ogg']);
    this.load.audio('sndDoorClose',
      ['assets/sounds/door-close.mp3', 'assets/sounds/door-close.ogg']);
    this.load.audio('sndWaiting',
      ['assets/sounds/waiting.mp3', 'assets/sounds/waiting.ogg']);
    this.load.audio('sndSteps',
      ['assets/sounds/steps.mp3', 'assets/sounds/steps.ogg']);
    this.load.audio('sndCar',
      ['assets/sounds/car.mp3', 'assets/sounds/car.ogg']);

    // sprites
    for (let i=0; i<NB_CAR_TYPES; i++) {
      this.load.image('car-'+i, 'assets/sprites/car-'+i+'.png');
    }
    for (let i=0; i<NB_NPC_TYPES; i++) {
      this.load.image('npc-'+i, 'assets/sprites/npc-'+i+'.png');
    }
    this.load.image('speech-bubble', 'assets/sprites/speech-bubble.png');
    this.load.image('waiting', 'assets/sprites/waiting.png');
    this.load.image('happy', 'assets/sprites/happy.png');
    this.load.image('angry', 'assets/sprites/angry.png');
    this.load.image('arrow', 'assets/sprites/arrow.png');
    this.load.image('loading-zone',
      'assets/sprites/loading-zone.png');
    this.load.spritesheet('player', 'assets/sprites/player.png',
      { frameWidth: 25, frameHeight: 51});
  };

  gameScene.create = function() {
    this.add.image(0, 0, 'background').setOrigin(0, 0);
    deliveryZone = this.add.image(103, 550, 'loading-zone');

    wallGroup = this.physics.add.staticGroup();
    // LEFT WALL
    wallGroup.create(205+10/2, 0+316/2, 'wall-left-top');
    wallGroup.create(205+10/2, 490+172/2, 'wall-left-bottom');
    // TOP WALL
    wallGroup.create(215+800/2, 61+10/2, 'wall-bottom');
    // BOTTOM WALL
    wallGroup.create(215+800/2, 652+10/2, 'wall-bottom');
    // RIGHT WALL
    wallGroup.create(1014+10/2, 0+662/2, 'wall-right');
    wallGroup.create(215+140/2, 196+120/2, 'booth');

    npcCarGroup = this.physics.add.group({});
    playerGroup = this.physics.add.group({
      collideWorldBounds: true,
    });
    npcGroup = this.physics.add.group({});
    uiGroup = this.physics.add.group({});

    player = playerGroup.create(400, 250, 'player');
    this.anims.create({
      key: 'moving',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [0, 1, 0, 2]}),
      frameRate: 10
    });
    player.speed = 0;

    // prepare collisions: player collides with world, cars, npcs and walls
    this.physics.add.collider(player, wallGroup);
    this.physics.add.collider(player, npcCarGroup, function(p, c) {
      p.nearest = c;
    });
    this.physics.add.collider(player, npcGroup);

    // keyboard interaction
    cursors = this.input.keyboard.createCursorKeys();

    // GUI
    // textCurrentMoney
    textTime = this.add.text(800, 15, minToTime(time), {
      fontFamily: 'gameplay', fontSize: 34, color: '#EEE' }, uiGroup);
    textMoney = this.add.text(230, 15, "$" + money, {
      fontFamily: 'gameplay', fontSize: 34, color: '#EEE' }, uiGroup);
    arrow = uiGroup.create(10, 10, 'arrow');

    sndMoney = this.sound.add('sndMoney');
    sndDoorOpen = this.sound.add('sndDoorOpen');
    sndDoorClose = this.sound.add('sndDoorClose');
    sndWaiting = this.sound.add('sndWaiting');
    sndSteps = this.sound.add('sndSteps');
    sndCar = this.sound.add('sndCar');
    sndSteps.volume = 0.5;
    sndWaiting.volume = 0.5;
    sndCar.volume = 0.5;
  };

  gameScene.initializeCarSprite = function(car) {
    const carSprite = npcCarGroup.create(
          214/2, - car.height, 'car-' + car.sprIndex);
    carSprite.speed = 0;
    carSprite.body.moves = false;
    carSprite.angle = 90;
    // starts off vertically, let's flip the body colliders
    carSprite.body.setSize(car.height, car.width, true);
    carSprite.bodyHorizontal = true;
    carSprite.data = car;
    return carSprite;
  };

  gameScene.updateTime = function() {
    timer += 1;
    if (timer >= timeSpeed) {
      timer = 0;
      time += 1;
      textTime.setText(minToTime(time));
      const newCar = levelCars[currentLevel].find(
        (car) => car.timeArrival === time);
      if (newCar) {
        npcCars.push(this.initializeCarSprite(newCar));
      }
    }
  };

  gameScene.updateControlledCar = function() {
    currentCar.body.angularVelocity = 0;
    currentCar.acceleration = 10;
    // just realized that the body colliders don't rotate in phaser...
    // because our sprite is rectangular, we'll try and rotate it
    // when needed
    if (currentCar.bodyHorizontal &&
      ((currentCar.angle > 45 && currentCar.angle < 135) ||
       (currentCar.angle > -135 && currentCar.angle < -45))) {
      currentCar.bodyHorizontal = false;
      currentCar.body.setSize(78, 130, true);
    } else if (!currentCar.bodyHorizontal &&
      ((currentCar.angle < 45 && currentCar.angle > -45) ||
       (currentCar.angle > 135 && currentCar.angle < 225))) {
      currentCar.bodyHorizontal = true;
      currentCar.body.setSize(130, 78, true);
    }

    const s = currentCar.speed > 0 ? 1 : -1;
    if (cursors.left.isDown) {
      currentCar.body.angularVelocity =
        -s * Math.abs(currentCar.speed / 2);
    }
    if (cursors.right.isDown) {
      currentCar.body.angularVelocity =
        s * Math.abs(currentCar.speed / 2);
    }
    if (cursors.up.isDown) {
      if (!sndCar.isPlaying && canPlayCarSound) {
        sndCar.play();
      }
      currentCar.speed += currentCar.acceleration;
      if (currentCar.speed > CAR_MAX_VELOCITY) {
        currentCar.speed = CAR_MAX_VELOCITY;
      }
    }
    if (cursors.down.isDown) {
      if (currentCar.speed > 0) {
        currentCar.speed -= currentCar.acceleration * 1.5;
      } else {
        currentCar.speed -= currentCar.acceleration / 2;
      }
      if (currentCar.speed < -CAR_MAX_VELOCITY / 2) {
        currentCar.speed = -CAR_MAX_VELOCITY / 2;
      }
    }
    currentCar.speed *= CAR_FRICTION;
    if (Math.abs(currentCar.speed) < 2) {
      currentCar.speed = 0;
    }

    if (cursors.space.isDown && currentCar.speed < 10 && !gettingInCar) {
      this.leaveCar();
    } else {
      this.physics.velocityFromAngle(currentCar.angle,
        currentCar.speed,
        currentCar.body.velocity);
    }
  };

  gameScene.updateCharacter = function() {
    player.body.velocity.x = 0;
    player.body.velocity.y = 0;
    player.body.angularVelocity = 0;

    if (cursors.left.isDown) {
      player.body.angularVelocity = -300;
    }
    if (cursors.right.isDown) {
      player.body.angularVelocity = 300;
    }
    if (cursors.up.isDown) {
      player.speed += 10;
      if (player.speed > HUMAN_MAX_VELOCITY) {
        player.speed = HUMAN_MAX_VELOCITY;
      }
      this.physics.velocityFromAngle(
        player.angle, player.speed, player.body.velocity);
      player.anims.play('moving', true);
      if (!sndSteps.isPlaying && timer % 20 == 0) {
        sndSteps.play();
      }
    } else {
      player.speed = 0;
      player.anims.play('moving', false);
    }
    if (cursors.space.isDown && player.nearest && !gettingInCar) {
      // calculate the coordinate of the door
      const car = player.nearest;
      // check distance with latest collided car
      const a = Math.abs(player.x - car.x);
      const b = Math.abs(player.y - car.y);
      const dist = Math.sqrt(a*a + b*b);
      if (dist < 70 && car.data.readyForPickup) {
        this.enterCar(car);
      }
    }
  };

  gameScene.enterCar = function(car) {
    currentCar = car;
    inCar = true;
    car.body.moves = true;
    player.disableBody(true, true);
    gettingInCar = true;
    sndDoorOpen.play();
    canPlayCarSound = false;
    setTimeout(function() {
      canPlayCarSound = true;
    }, 1000);

    if (car.data.isNPC &&
        car.data.npcSprite && car.data.npcSprite.body.enable) {
      car.data.npcSprite.disableBody(true, true);
      if (waitingNpc && waitingNpc.waitingForService) {
        if (waitingNpc.speech) {
          waitingNpc.speech.destroy();
          waitingNpc.speechText.destroy();
          waitingNpc.waitingForService = false;
          waitingNpc.willPickupCar = true;
          // the npc will now go to the pending queue
          pendingCustomers.push(waitingNpc);
          pendingCustomers = pendingCustomers.sort(
            (c1,c2) => c1.timePickup >= c2.timePickup);
          waitingNpc = null;
        }
      }
    }
    car.data.isNPC = false;
    car.setCollideWorldBounds(true);
    car.setBounce(0.2);
    car.setMaxVelocity(CAR_MAX_VELOCITY, CAR_MAX_VELOCITY);
    car.speed = 0;
    car.bodyHorizontal = (car.angle > 45 && car.angle < 135) ||
                         (car.angle > -135 && car.angle < -45);
    if (car.bodyHorizontal) {
      car.body.setSize(car.data.width, car.data.height, true);
    } else {
      car.body.setSize(car.data.height, car.data.width, true);
    }
    this.physics.add.collider(car, wallGroup);
    this.physics.add.collider(car, npcCarGroup);

    setTimeout(function() {
      gettingInCar = false;
    }, 500);
  };

  gameScene.leaveCar = function() {
    // calculate the coordinate of the player
    let doorX, doorY;
    if (!currentCar.bodyHorizontal && currentCar.angle > 45 && currentCar.angle < 135) {
      doorX = currentCar.x + 60;
      doorY = currentCar.y + 15;
      // looking up
    } else if (!currentCar.bodyHorizontal && currentCar.angle > -135 && currentCar.angle < -45) {
      doorX = currentCar.x - 60;
      doorY = currentCar.y - 15;
    } else if (currentCar.bodyHorizontal && currentCar.angle < 45 && currentCar.angle > -45) {
      doorX = currentCar.x + 15;
      doorY = currentCar.y - 60;
    } else {
      doorX = currentCar.x - 15;
      doorY = currentCar.y + 60;
    }
    inCar = false;
    currentCar.body.moves = false;
    player.enableBody(false, doorX, doorY, true, true);
    player.setPosition(doorX, doorY);
    gettingInCar = true;
    currentCar = null;
    setTimeout(function() {
      gettingInCar = false;
    }, 500);
    sndDoorClose.play();

    // check if the car was disposed within the delivery area.
    if (carReadyForCustomer) {
      carReadyForCustomer = false;
      const leavingCustomer = pendingCustomers[0];
      leavingCustomer.appeared = false;
      leavingCars.push(leavingCustomer.car);
      if (leavingCustomer.impatient) {
        leavingCustomer.waiting.destroy();
      }
      if (leavingCustomer.mad) {
        leavingCustomer.angry.destroy();
      }
      leavingCustomer.sprite.destroy();
      if (time < leavingCustomer.timePickup + TIME_GET_IMPATIENT) {
        this.giveMoney(30 + random(10,15));
      } else if (time < leavingCustomer.timePickup + TIME_GET_FRUSTRATED) {
        this.giveMoney(20 + random(5,15));
      } else if (time < leavingCustomer.timePickup + TIME_GET_MAD) {
        this.giveMoney(10 + random(5,10));
      }
      leavingCustomer.car.data.readyForPickup = false;
      pendingCustomers = pendingCustomers.filter(
        (customer) => customer != leavingCustomer);
      this.reorderPeopleWaitingOutside();
    }
  }

  gameScene.updateLeavingCars = function() {
    let toRemove = null;
    leavingCars.forEach((car, index) => {
      car.y += 1;
      if (car.angle > 90) {
        car.angle -= 1;
      } else if (car.angle < 90) {
        car.angle += 1;
      }
      if (car.y > 1000) {
        delete(car.data);
        car.destroy();
        toRemove = car;
      }
    });
    if (toRemove) {
      leavingCars = leavingCars.filter((car) => car != toRemove);
      npcCars = npcCars.filter((car) => car != toRemove);
    }
  }

  gameScene.updateNpcCar = function(car) {
    if (!car.data.isNPC) return;
    let canMove = true;
    const rect = new Phaser.Geom.Rectangle(
      car.x-car.width/2, car.y+car.height/2, car.width, 50);
    // check if the npc car can move compared to the player's position
    if (!inCar) {
      const playerRec = new Phaser.Geom.Rectangle(
        player.x - player.width/2,
        player.y - player.height/2,
        player.width,
        player.height,
      );
      let intersection = Phaser.Geom.Intersects.GetRectangleIntersection(
        rect, playerRec);
      if (intersection.height > 0) {
        canMove = false;
      }
    }
    if (canMove) {
     // check if the npc car can move compared to other cars
      npcCars.filter((npc) => npc !== car && !car.data.readyForPickup)
             .forEach((npc) => {
        const npcBounds = new Phaser.Geom.Rectangle(
          npc.body.x-npc.width/2, npc.body.y-npc.height/2,
          npc.body.width, npc.body.height)
        let intersection = Phaser.Geom.Intersects.GetRectangleIntersection(
          rect, npcBounds);
        if (intersection.height > 0) {
          canMove = false;
          return;
        }
      });
    }

    if (canMove && car.y < npcStopY) {
      car.y += 1;
      if (car.y === npcStopY) { // unload passanger who becomes a waitingNpc
        car.data.readyForPickup = true;
        const npcSprite = this.physics.add.sprite(
              car.x - car.width/2 - 10,
              car.y + car.height/2,
              'npc-' + car.data.npcSprIndex);
        sndDoorOpen.play();
        npcSprite.angle = random(-45, 45);
        npcSprite.speed = 0;
        npcSprite.body.moves = false;
        car.data.npcSprite = npcSprite;
        waitingNpc = {
          sprite: npcSprite,
          waitingForService: true,
          hasWaitedFor: 0,
          timePickup: car.data.timePickup,
          car: car,
        };
        this.physics.add.collider(player, npcSprite);
      }
    }
  };

  // current car to move out
  gameScene.updateCurrentTargetCar = function() {
    let displayed = false;

    let waitingCustomers = (pendingCustomers || [])
      .filter(c => c.appeared);
    if (waitingCustomers.length > 0) {
      const nextCustomer = waitingCustomers[0];
      const car = nextCustomer.car;
      if (!inCar || (currentCar != car)) {
        displayed = true;
        arrow.y = car.y - 100;
        arrow.x = car.x;
      }
    }
    arrowTimer += 1;
    arrow.y += arrowDir;
    if (arrowTimer == 10) {
      arrowTimer = 0;
      arrowDir *= -1;
    }
    if (!displayed) {
      arrow.x = -1000;
    }
  }

  gameScene.giveMoney = function(amount) {
    actualMoney += amount;
    sndMoney.play();
  }

  gameScene.updateMoney = function() {
    if (money < actualMoney) {
      money += 1;
      textMoney.setStyle(
        {fontFamily: 'gameplay', fontSize: 38, color: '#6abe30' });
    } else {
      textMoney.setStyle(
        {fontFamily: 'gameplay', fontSize: 34, color: '#EEE' });
    }
  }

  gameScene.updateWaitingNpc = function() {
    if (waitingNpc) {
      const npc = waitingNpc;
      if (npc.waitingForService) {
        npc.hasWaitedFor += 1;
        if (npc.hasWaitedFor == 30 && npc.sprite.body.enable) {
          npc.speech = uiGroup.create(
            npc.sprite.x + 70,
            npc.sprite.y - 40,
            'speech-bubble');
          npc.speechText = this.add.text(
            npc.speech.x-npc.speech.width/2 + 20,
            npc.speech.y-npc.speech.height/2 + 5,
            minToTime(npc.timePickup, true), {
              fontFamily: 'gameplay', fontSize: 14, color: '#820b0b'
            }, uiGroup);
        }
      }
    }
  }

  gameScene.updatePendingCustomers = function() {
    const waitingOutside = pendingCustomers.filter((c) => c.appeared);
    const nbCurrentlyWaitingOutside = waitingOutside.length;
    pendingCustomers.forEach((npc) => {
      if (npc.willPickupCar && !npc.appeared && time === npc.timePickup) {
        npc.appeared = true; // prevent to visit this twice
        npc.sprite.enableBody(
          false, 0, 0, true, true);
        npc.sprite.x = 200;
        npc.sprite.y = 480 + nbCurrentlyWaitingOutside * 40;
        npc.sprite.angle = random(-75, -105);
        sndWaiting.play();
      } else if (npc.appeared) {
        if (time === npc.timePickup + TIME_GET_IMPATIENT && !npc.impatient) {
          npc.impatient = true;
          npc.waiting = uiGroup.create(
            npc.sprite.x + 40, npc.sprite.y - 40, 'waiting');
        } else if (time > npc.timePickup + TIME_GET_FRUSTRATED &&
                   time < npc.timePickup + TIME_GET_MAD) {
          if (random(1, 20) === 5) {
            npc.sprite.angle = random(-85, -95);
          }
        } else if (time === npc.timePickup + TIME_GET_MAD && !npc.mad) {
          npc.mad = true;
          npc.impatient = false;
          npc.waiting.destroy();
          npc.angry = uiGroup.create(
            npc.sprite.x + 40,
            npc.sprite.y - 40,
            'angry');
        } else if (time > npc.timePickup + TIME_GET_MAD) {
          if (random(1, 10) == 1) {
            npc.sprite.angle = random(-80, -100);
          }
        }
      }
    });
  };

  gameScene.reorderPeopleWaitingOutside = function() {
    // list is already sorted, we just need to move the people and whatever
    // they are saying
    const waitingOutside = pendingCustomers.filter((c) => c.appeared);
    waitingOutside.forEach((npc, index) => {
      npc.sprite.y = 480 + index * 40;
      if (npc.impatient) {
        npc.waiting.y = npc.sprite.y - 40;
      } else if (npc.mad) {
        npc.angry.y = npc.sprite.y - 40;
      }
    });
  }

  gameScene.updateDeliveryPlatform = function() {
    // only check the tint every couple of frames to avoid flicker
    platformTimer += 1;

    if (platformTimer == 30) {
      platformTimer = 0;
      // player is in car
      deliveryZone.tint = TINT_NONE;
      carReadyForCustomer = false;
      let waitingCustomers = (pendingCustomers || [])
        .filter(c => c.appeared);
      if (waitingCustomers.length > 0) {
        const nextCustomer = waitingCustomers[0];
        const car = nextCustomer.car;
        if (currentCar == car) {
          const carRect = new Phaser.Geom.Rectangle(
            car.x-car.width/2, car.y-car.height/2, car.width, car.height);
          const deliveryRect = new Phaser.Geom.Rectangle(
            deliveryZone.x-deliveryZone.width/2,
            deliveryZone.y-deliveryZone.height/2,
            deliveryZone.width,
            deliveryZone.height);
          let intersection = Phaser.Geom.Intersects.GetRectangleIntersection(
            carRect, deliveryRect);
          if (intersection.height == carRect.height) {
            carReadyForCustomer = true;
            deliveryZone.tint = TINT_SUCCESS;
          } else if (intersection.height > 0) {
            deliveryZone.tint = TINT_WARNING;
          }
        }
      }
    }
  };

  gameScene.update = function() {
    this.updateTime();
    this.updateMoney();
    if (!music.isPlaying) {
      music.play();
    }
    textMoney.setText("$" + money);
    this.updateWaitingNpc(); // person who waits for service
    this.updatePendingCustomers(); // people who are here for pickup
    this.updateCurrentTargetCar();
    this.updateDeliveryPlatform();
    if (inCar) {
      this.updateControlledCar();
    } else {
      this.updateCharacter();
    }
    npcCars.forEach((car) => {
      this.updateNpcCar(car);
    });
    this.updateLeavingCars();
  };


  /******
   * MAIN MENU
   ******/
  const menuScene = new Phaser.Scene('MainMenu');
  let menuBg;
  let textMenuInstructions, textMenuPlay;
  let currentOption = 0;
  let button;
  let keyPressed = false;

  menuScene.preload = function() {
    this.load.image('menu-bg', 'assets/backgrounds/mainmenu.png');
    this.load.image('button', 'assets/sprites/button.png');
    this.load.audio('theme',
      ['assets/music/ld42-ballad.mp3', 'assets/music/ld42-ballad.ogg']);
  }

  menuScene.create = function() {
    menuBg = this.add.image(0, 0, 'menu-bg').setOrigin(0, 0);
    this.add.text(410, 420, "USE ARROWS+SPACE", {
      fontFamily: 'gameplay', fontSize: 34, color: '#3f3f74' });
    textMenuInstructions = this.add.text(120, 500, "HOW TO PLAY", {
      fontFamily: 'gameplay', fontSize: 34, color: '#FFF' });
    textMenuPlay = this.add.text(120, 560, "START GAME", {
      fontFamily: 'gameplay', fontSize: 34, color: '#847e87' });
    button = this.add.sprite(90, 520, 'button');
    cursors = this.input.keyboard.createCursorKeys();
    keyPressed = true;
    if (!music || !music.isPlaying) {
      music = this.sound.add('theme');
      music.play();
    }
  }

  menuScene.update = function() {
    if (cursors.up.isDown && !keyPressed) {
      keyPressed = true;
      currentOption -= 1;
      if (currentOption < 0) {
        currentOption = 1;
      }
    } else if (cursors.down.isDown && !keyPressed) {
      keyPressed = true;
      currentOption += 1;
      if (currentOption > 1) {
        currentOption = 0;
      }
    } else if (cursors.space.isDown && !keyPressed) {
      keyPressed = true;
      if (currentOption == 0) {
        currentLevel = 0;
        this.scene.start('HowToPlay');
      } else {
        this.scene.start('PreLevel');
      }
    }
    if (!cursors.up.isDown && !cursors.down.isDown) {
      keyPressed = false;
    }

    if (currentOption == 0) {
      textMenuInstructions.setStyle({
        fontFamily: 'gameplay', fontSize: 34, color: '#FFF' });
      textMenuPlay.setStyle({
        fontFamily: 'gameplay', fontSize: 34, color: '#847e87' });
      button.y = 520;
    } else {
      textMenuInstructions.setStyle({
        fontFamily: 'gameplay', fontSize: 34, color: '#847e87' });
      textMenuPlay.setStyle({
        fontFamily: 'gameplay', fontSize: 34, color: '#FFF' });
      button.y = 580;
    }
  }


  /******
   * INSTRUCTIONS
   ******/
  const howToPlayScene = new Phaser.Scene('HowToPlay');

  howToPlayScene.preload = function() {
    this.load.image('instructions-bg',
      'assets/backgrounds/instructions-1.png');
  }

  howToPlayScene.create = function() {
    this.add.image(0, 0, 'instructions-bg').setOrigin(0, 0);
    this.add.text(470, 100, "AS A VALET FOR THE PRESTIGIOUS\n" +
      "FRENCH LE PARKING, COLLECT AND\n" +
      "PARK CARS AS THEY ARRIVE.\n\n" +
      "CHECK THE PICKUP TIME AND\n" +
      "PARK ACCORDINGLY."
      , {
      fontFamily: 'gameplay', fontSize: 20, color: '#FFF' });
    this.add.text(120, 440, "WHEN THE TIME ARRIVES\n" +
      "BRING THE CARS TO THE\n" +
      "DELIVERY AREA.\n\n" +
      "HURRY AND YOU MIGHT\n" +
      "GET A HEFTY TIP."
      , {
      fontFamily: 'gameplay', fontSize: 20, color: '#FFF' });
    this.add.text(650, 620, "HIT SPACE TO CONTINUE"
      , {
      fontFamily: 'gameplay', fontSize: 20, color: '#CCC' });
    keyPressed = true;
  }

  howToPlayScene.update = function() {
    if (cursors.space.isDown && !keyPressed) {
      keyPressed = true;
      this.scene.start('MainMenu');
    }
    if (!cursors.space.isDown) {
      keyPressed = false;
    }
  }


  /******
   * PRE-LEVEL
   ******/
  const preLevelScene = new Phaser.Scene('PreLevel');

  preLevelScene.preload = function() {
    this.load.image('prelevel',
      'assets/backgrounds/prelevel.png');
  }

  preLevelScene.create = function() {
    this.add.image(0, 0, 'prelevel').setOrigin(0, 0);
    keyPressed = true;
    if (isPrevLevelGoodPerf === null) {
      this.add.text(530, 150,
        "HA!! ZERE YOU ARE!!\n" +
        "I COULD SMELL YOU FROM\n" +
        "ZE STREET!\n\n" +
        "ZIS IS YOUR FIRST DAY...\n" +
        "MAYBE ZE LAST HON HON HON!\n\n" +
        "YOUR WORK STARTS AT 1PM\n" +
        "UNTIL 7PM. DON'T BE LATE!\n\n" +
        "NOW GO AND PARK ZE CARS\n" +
        "AND MAKE VINCENT RICH!"
        , {
        fontFamily: 'gameplay', fontSize: 20, color: '#FFF' });
      this.add.text(650, 620, "HIT SPACE TO CONTINUE"
        , {
        fontFamily: 'gameplay', fontSize: 20, color: '#CCC' });
    }
  }

  preLevelScene.update = function() {
    if (cursors.space.isDown && !keyPressed) {
      keyPressed = true;
      this.scene.start('Game');
    }
    if (!cursors.space.isDown) {
      keyPressed = false;
    }
  }


  new Phaser.Game({
    type: Phaser.AUTO,
    width: 1024,
    height: 662,
    pixelArt: true,
    physics: {
      default: 'arcade',
    },
    scene: [menuScene, howToPlayScene, preLevelScene, gameScene]
  });

})();