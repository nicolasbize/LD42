(function() {

  // utility functions
  function minToTime(mins, noPrefix) {
    const hours = Math.floor(mins / 60);
    const remnant = mins % 60;
    let txt = "";
    if (hours < 10 && !noPrefix) {
      txt = "0";
    }
    txt += hours + ":";
    if (remnant < 10) {
      txt += "0";
    }
    txt += remnant;
    txt += (hours < 12) ? "AM" : "PM"
    return txt;
  }

  // return an integer within [min,max]
  function random(min, max) {
    return min + Math.floor(Math.random() * (max+1-min));
  }

  const CAR_FRICTION = 0.97;
  const CAR_MAX_VELOCITY = 300;
  const HUMAN_MAX_VELOCITY = 200;
  const NB_NPC_TYPES = 6;
  const NB_CAR_TYPES = 3;
  const TIME_GET_IMPATIENT = 5;
  const TIME_GET_FRUSTRATED = 10;
  const TIME_GET_MAD = 20;
  const TINT_NONE = 0xffffff;
  const TINT_SUCCESS = 0x99e550;
  const TINT_WARNING = 0xfbf236;

  let wallGroup, npcCarGroup, npcGroup, uiGroup, playerGroup;
  let player, cursors, currentCar, deliveryZone;
  let music;
  let sndMoney, sndDoorOpen, sndDoorClose, sndWaiting, sndSteps, sndCar;
  let inCar = false;
  let gettingInCar = false;
  let money = 0, time = 7 * 60;
  let actualMoney = 0;
  let textCurrentMoney, textTime;
  let cars = [];
  let timer = 0;
  let carReadyForCustomer = false;
  const timeSpeed = 60; // the bigger the slower
  const npcStopY = 260;
  let waitingNpcs = [];
  let pendingCustomers = [];
  let leavingCars = [];
  let arrow, arrowTimer = 0, arrowDir = 1;
  let platformTimer = 0;
  let canPlayCarSound = false;

  let levelCars = [{
    sprIndex: 0,
    timeArrival: 7 * 60 + 1, // 9AM in min
    timePickup: 7 * 60 + 10,
    npcSprIndex: random(0, NB_NPC_TYPES-1),
    width: 130,
    height: 78,
    isNPC: true,
    readyForPickup: false,
  }, {
    sprIndex: 1,
    timeArrival: 7 * 60 + 10, // 9AM in min
    npcSprIndex: random(0, NB_NPC_TYPES-1),
    timePickup: 10 * 60, //8am
    width: 130,
    height: 78,
    isNPC: true,
    readyForPickup: false,
  }, {
    sprIndex: 2,
    timeArrival: 7 * 60 + 20, // 9AM in min
    npcSprIndex: random(0, NB_NPC_TYPES-1),
    timePickup: 10 * 60, //8am
    width: 130,
    height: 78,
    isNPC: true,
    readyForPickup: false,
  }];
  let npcCars = [];

  const scene = new Phaser.Scene('Game');

  // LOADING ASSETS
  scene.preload = function() {
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

    this.load.audio('theme',
      ['assets/music/ld42-ballad.mp3', 'assets/music/ld42-ballad.ogg']);
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

  scene.create = function() {
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

    music = this.sound.add('theme');
    music.play();

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

  scene.initializeCarSprite = function(car) {
    const carSprite = npcCarGroup.create(
          214/2, -car.height / 2-5, 'car-' + car.sprIndex);
    carSprite.speed = 0;
    carSprite.body.moves = false;
    carSprite.angle = 90;
    // starts off vertically, let's flip the body colliders
    carSprite.body.setSize(car.height, car.width, true);
    carSprite.bodyHorizontal = true;
    carSprite.data = car;
    return carSprite;
  };

  scene.updateTime = function() {
    timer += 1;
    if (timer >= timeSpeed) {
      timer = 0;
      time += 1;
      textTime.setText(minToTime(time));
      const newCar = levelCars.find((car) => car.timeArrival === time);
      if (newCar) {
        npcCars.push(this.initializeCarSprite(newCar));
      }
    }
  };

  scene.updateControlledCar = function() {
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

  scene.updateCharacter = function() {
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

  scene.enterCar = function(car) {
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
      waitingNpcs
        .filter((npc) => npc.waitingForService)
        .forEach((npc) => {
          if (npc.speech) {
            npc.speech.destroy();
            npc.speechText.destroy();
            npc.waitingForService = false;
            npc.willPickupCar = true;
          }
        });
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

  scene.leaveCar = function() {
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
      leavingCars.push(leavingCustomer.car);
      try{ // this sometimes fails for some reason..
        if (leavingCustomer.waiting) {
        leavingCustomer.waiting.destroy();
        }
        if (leavingCustomer.angry) {
          leavingCustomer.angry.destroy();
        }
        leavingCustomer.sprite.destroy();
      } catch (err) {}
      if (time < leavingCustomer.timePickup + TIME_GET_IMPATIENT) {
        this.giveMoney(TIME_GET_FRUSTRATED + TIME_GET_MAD +
          (time - leavingCustomer.timePickup + TIME_GET_IMPATIENT));
      }
      pendingCustomers = pendingCustomers.slice(1);
      leavingCustomer.car.data.readyForPickup = false;
      pendingCustomers = pendingCustomers.filter(
        (customer) => customer != leavingCustomer);
      // also remove the obj from waitingNpcs
      waitingNpcs = waitingNpcs.filter(
        (npc) => npc.car != leavingCustomer.car);
    }
  }

  scene.updateLeavingCars = function() {
    let toRemove = null;
    leavingCars.forEach((car, index) => {
      car.y += 1;
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

  scene.updateNpcCar = function(car) {
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
        waitingNpcs.push({
          sprite: npcSprite,
          waitingForService: true,
          hasWaitedFor: 0,
          timePickup: car.data.timePickup,
          car: car,
        });
        this.physics.add.collider(player, npcSprite);
      }
    }
  };

  // current car to move out
  scene.updateCurrentTargetCar = function() {
    let displayed = false;

    if (pendingCustomers.length > 0) {
      const nextCustomer = pendingCustomers[0];
      const car = nextCustomer.car;
      if (!inCar || (currentCar != car)) {
        displayed = true;
        this.scene.bringToTop(arrow);
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

  scene.giveMoney = function(amount) {
    actualMoney += amount;
    sndMoney.play();
  }

  scene.updateMoney = function() {
    if (money < actualMoney) {
      money += 1;
      textMoney.setStyle(
        {fontFamily: 'gameplay', fontSize: 38, color: '#6abe30' });
    } else {
      textMoney.setStyle(
        {fontFamily: 'gameplay', fontSize: 34, color: '#EEE' });
    }
  }

  scene.updateWaitingNpcs = function() {
    waitingNpcs.forEach((npc) => {
      if (npc.waitingForService) {
        npc.hasWaitedFor += 1;
        if (npc.hasWaitedFor == 60 && npc.sprite.body.enable) {
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
      } else if (npc.willPickupCar && !npc.appeared) {
        if (time === npc.timePickup) {
          npc.sprite.enableBody(
            false, 0, 0, true, true);
          npc.sprite.x = 200;
          npc.sprite.y = 480 + pendingCustomers.length * 20
          npc.sprite.angle = random(-75, -105);
          npc.appeared = true;
          sndWaiting.play();
          pendingCustomers.push(npc);
        }
      } else if (npc.appeared) {
        if (time === npc.timePickup + TIME_GET_IMPATIENT && !npc.waiting) {
          npc.waiting = uiGroup.create(
            npc.sprite.x + 40,
            npc.sprite.y - 40,
            'waiting');
        } else if (time > npc.timePickup + TIME_GET_FRUSTRATED &&
                   time < npc.timePickup + TIME_GET_MAD) {
          if (random(1, 20) === 5) {
            npc.sprite.angle = random(-85, -95);
          }
        } else if (time === npc.timePickup + TIME_GET_MAD && !npc.mad) {
          npc.waiting.destroy();
          npc.angry = uiGroup.create(
            npc.sprite.x + 40,
            npc.sprite.y - 40,
            'angry');
          npc.mad = true;
        } else if (time > npc.timePickup + TIME_GET_MAD) {
          if (random(1, 10) == 1) {
            npc.sprite.angle = random(-80, -100);
          }
        }
      }

    })
  };

  scene.updateDeliveryPlatform = function() {
    // only check the tint every couple of frames to avoid flicker
    platformTimer += 1;

    if (platformTimer == 30) {
      platformTimer = 0;
      // player is in car
      deliveryZone.tint = TINT_NONE;
      carReadyForCustomer = false;
      if (pendingCustomers.length > 0) {
        const nextCustomer = pendingCustomers[0];
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

  scene.update = function() {
    this.updateTime();
    this.updateMoney();
    if (!music.isPlaying) {
      music.play();
    }
    textMoney.setText("$" + money);
    this.updateWaitingNpcs();
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

  new Phaser.Game({
    type: Phaser.AUTO,
    width: 1024,
    height: 662,
    pixelArt: true,
    physics: {
      default: 'arcade',
    },
    scene: scene
  });

})();