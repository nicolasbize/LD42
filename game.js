(function() {

  let walls, player, cursors, currentCar;
  const CAR_FRICTION = 0.97;
  const CAR_MAX_VELOCITY = 300;
  const HUMAN_MAX_VELOCITY = 200;
  let inCar = false;
  let gettingInCar = false;
  let pixel, debugPxl;
  let money = 0, time = 7 * 60;
  let textCurrentMoney, textTime;
  let cars = [];
  let timer = 0;
  let timeSpeed = 60; // the bigger the slower

  let levelCars = [{
    sprIndex: 0,
    timeArrival: 540, // 9AM in min
    willStayFor: 120+15*Math.floor(Math.random() * 16),
    width: 130,
    height: 78,
    willWaitFor: 15, // how long the person will wait
    hasWaitedFor: 0,
    isNPC: true,
  }];

  function sinDegrees(angle) {return Math.sin(angle/180*Math.PI);};
  function cosDegrees(angle) {return Math.cos(angle/180*Math.PI);};
  function minToTime(mins) {
    const hours = Math.floor(mins / 60);
    const remnant = mins % 60;
    let txt = "";
    if (hours < 10) {
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

  new Phaser.Game({
    type: Phaser.AUTO,
    width: 1024,
    height: 662,
    physics: {
      default: 'arcade',
    },
    scene: {
      preload: function() {
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

        // this.load.image('pixel', 'assets/debug-pixel.png');

        // sprites
        this.load.image('yellow-car', 'assets/sprites/car-yellow.png');
        this.load.spritesheet('player', 'assets/sprites/player.png',
          { frameWidth: 25, frameHeight: 51});

      },
      create: function() {
        this.add.image(0, 0, 'background').setOrigin(0, 0);
        walls = this.physics.add.staticGroup();
        // LEFT WALL
        walls.create(205+10/2, 0+316/2, 'wall-left-top');
        walls.create(205+10/2, 490+172/2, 'wall-left-bottom');
        // TOP WALL
        walls.create(215+800/2, 61+10/2, 'wall-bottom');
        // BOTTOM WALL
        walls.create(215+800/2, 652+10/2, 'wall-bottom');
        // RIGHT WALL
        walls.create(1014+10/2, 0+662/2, 'wall-right');
        walls.create(215+140/2, 196+120/2, 'booth');

        currentCar = this.physics.add.sprite(500, 200, 'yellow-car');
        currentCar.setCollideWorldBounds(true);
        // currentCar.setBounce(0.2);
        currentCar.setMaxVelocity(CAR_MAX_VELOCITY, CAR_MAX_VELOCITY);
        currentCar.speed = 0;
        currentCar.body.moves = false;
        currentCar.body.setSize(130, 78, true);
        currentCar.bodyHorizontal = true;

        player = this.physics.add.sprite(400, 250, 'player');
        player.setCollideWorldBounds(true);
        this.anims.create({
          key: 'moving',
          frames: this.anims.generateFrameNumbers('player', {
            frames: [0, 1, 0, 2]}),
          frameRate: 10
        });
        player.speed = 0;

        // prepare collisions
        this.physics.add.collider(currentCar, walls);
        this.physics.add.collider(player, walls);
        this.physics.add.collider(player, currentCar, function(p, c) {
          p.nearest = c;
        });

        cursors = this.input.keyboard.createCursorKeys();

        // GUI
        // textCurrentMoney
        textTime = this.add.text(850, 20, minToTime(time), { fontFamily: 'Monospace', fontSize: 34, color: '#FFF' });
        textMoney = this.add.text(230, 20, "$" + money, { fontFamily: 'Monospace', fontSize: 34, color: '#FFF' });

        // debugPxl = this.add.image(10, 0, 'dpixel');
      },
      update: function() {
        timer += 1;
        if (timer >= timeSpeed) {
          timer = 0;
          time += 1;
          textTime.setText(minToTime(time));
        }
        textMoney.setText("$" + money);
        if (inCar) {
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
            setTimeout(function() {
              gettingInCar = false;
            }, 500);
          } else {
            this.physics.velocityFromAngle(currentCar.angle,
              currentCar.speed,
              currentCar.body.velocity);
          }

        } else {
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
            if (dist < 70) {
              inCar = true;
              car.body.moves = true;
              player.disableBody(true, true);
              gettingInCar = true;
              setTimeout(function() {
                gettingInCar = false;
              }, 500);
            }
          }
        }
      },
    }
  });

})();