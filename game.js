const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let player, cursors, bullets, lastFired = 0;
let enemies, enemyBullets, lastEnemyFire = 0;
let score = 0, scoreText;

const PLAYER_SPEED = 200;
const BULLET_SPEED = 400;
const ENEMY_SPEED = 80;
const ENEMY_BULLET_SPEED = 300;
const ENEMY_FIRE_INTERVAL = 1200; // ms

const game = new Phaser.Game(config);

function preload() {
    this.load.image('player', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/phaser-dude.png');
    this.load.image('enemy', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/robot.png');
    this.load.image('bullet', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bullet.png');
    this.load.image('bg', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/skies/space3.png');
}

function create() {
    this.add.image(400, 300, 'bg').setScale(1.2);

    // Player setup
    player = this.physics.add.sprite(400, 550, 'player').setScale(0.7);
    player.setCollideWorldBounds(true);

    // Bullets group
    bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: true });
    enemyBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: true });

    // Enemies group
    enemies = this.physics.add.group();
    for (let i = 0; i < 5; i++) {
        let enemy = enemies.create(150 + i * 120, 100, 'enemy').setScale(0.7);
        enemy.setData('alive', true);
        enemy.setVelocityX((i % 2 === 0 ? 1 : -1) * ENEMY_SPEED);
    }

    // Input
    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', () => shootBullet(this));

    // Collisions
    this.physics.add.overlap(bullets, enemies, bulletHitsEnemy, null, this);
    this.physics.add.overlap(enemyBullets, player, bulletHitsPlayer, null, this);

    // Score
    scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '24px', fill: '#fff' });
}

function update(time, delta) {
    // Player movement
    player.setVelocity(0);
    if (cursors.left.isDown) player.setVelocityX(-PLAYER_SPEED);
    if (cursors.right.isDown) player.setVelocityX(PLAYER_SPEED);
    if (cursors.up.isDown) player.setVelocityY(-PLAYER_SPEED);
    if (cursors.down.isDown) player.setVelocityY(PLAYER_SPEED);

    // Enemies movement and shooting
    enemies.getChildren().forEach(enemy => {
        if (!enemy.getData('alive')) return;
        // Bounce on edges
        if (enemy.x < 40 || enemy.x > 760) {
            enemy.setVelocityX(-enemy.body.velocity.x);
        }
        // Enemy shooting
        if (time > lastEnemyFire + ENEMY_FIRE_INTERVAL) {
            fireEnemyBullet(enemy, this);
        }
    });
    if (time > lastEnemyFire + ENEMY_FIRE_INTERVAL) lastEnemyFire = time;
}

// Player shooting
function shootBullet(scene) {
    let bullet = bullets.get(player.x, player.y - 30, 'bullet');
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.body.velocity.y = -BULLET_SPEED;
        bullet.setScale(0.7);
    }
}

// Enemy shooting
function fireEnemyBullet(enemy, scene) {
    if (!enemy.getData('alive')) return;
    let bullet = enemyBullets.get(enemy.x, enemy.y + 20, 'bullet');
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.body.velocity.y = ENEMY_BULLET_SPEED;
        bullet.setScale(0.7);
    }
}

// Bullet hits enemy
function bulletHitsEnemy(bullet, enemy) {
    bullet.disableBody(true, true);
    enemy.setData('alive', false);
    enemy.disableBody(true, true);
    score += 10;
    scoreText.setText('Score: ' + score);
}

// Bullet hits player
function bulletHitsPlayer(player, bullet) {
    bullet.disableBody(true, true);
    player.setTint(0xff0000);
    player.scene.time.delayedCall(200, () => {
        player.clearTint();
    });
    score -= 5;
    scoreText.setText('Score: ' + score);
}
