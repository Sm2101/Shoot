const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 640,
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

// Game variables
let player, cursors, bullets, enemies, enemyBullets, pickups, explosions;
let lastFired = 0, lastEnemyFire = 0, weaponIndex = 0;
let score = 0, scoreText, healthText, weaponText, ammoText;
let playerHealth = 100, playerMaxHealth = 100, playerAmmo = {pistol: 20, shotgun: 8, grenade: 2};
let weapons = [
    {name: 'Pistol', key: 'pistol', damage: 20, fireRate: 350, ammoKey: 'pistol', sound: 'pistol', range: 700},
    {name: 'Shotgun', key: 'shotgun', damage: 40, fireRate: 900, ammoKey: 'shotgun', sound: 'shotgun', range: 400},
    {name: 'Grenade', key: 'grenade', damage: 80, fireRate: 2000, ammoKey: 'grenade', sound: 'grenade', range: 500}
];
let weaponKeys = ['ONE', 'TWO', 'THREE'];
let isGameOver = false;
let pickupTypes = ['health', 'ammo'];

const ENEMY_SPEED = 60;
const ENEMY_FIRE_INTERVAL = 1500; // ms
const ENEMY_CHASE_DIST = 220;
const ENEMY_HEALTH = 60;
const ENEMY_BULLET_SPEED = 220;
const MAX_ENEMIES = 7;

function preload() {
    // Sprites
    this.load.image('player', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/phaser-dude.png');
    this.load.image('enemy', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/robot.png');
    this.load.image('bullet', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bullet.png');
    this.load.image('shotgun_bullet', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bullet.png');
    this.load.image('grenade', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bomb.png');
    this.load.image('explosion', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/particles/yellow.png');
    this.load.image('pickup_health', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/health.png');
    this.load.image('pickup_ammo', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/ammo.png');
    this.load.image('bg', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/skies/space3.png');
    // Sounds
    this.load.audio('pistol', 'https://cdn.pixabay.com/audio/2022/10/16/audio_12b9c1fd2f.mp3'); // pistol
    this.load.audio('shotgun', 'https://cdn.pixabay.com/audio/2022/10/16/audio_12b9c1fd2f.mp3'); // shotgun (same for demo)
    this.load.audio('grenade', 'https://cdn.pixabay.com/audio/2022/10/16/audio_12b9c1fd2f.mp3'); // grenade (same for demo)
    this.load.audio('hit', 'https://cdn.pixabay.com/audio/2022/03/15/audio_115bcead7c.mp3');
    this.load.audio('pickup', 'https://cdn.pixabay.com/audio/2022/03/15/audio_115bcead7c.mp3');
    this.load.audio('explosion_sound', 'https://cdn.pixabay.com/audio/2022/03/15/audio_115bcead7c.mp3');
}

function create() {
    this.add.image(480, 320, 'bg').setScale(1.3);

    // Player setup
    player = this.physics.add.sprite(480, 580, 'player').setScale(0.7);
    player.setCollideWorldBounds(true);
    player.health = playerMaxHealth;

    // Groups
    bullets = this.physics.add.group();
    enemyBullets = this.physics.add.group();
    enemies = this.physics.add.group();
    pickups = this.physics.add.group();
    explosions = this.add.group();

    // Spawn enemies
    spawnEnemies(this);

    // UI texts
    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff' });
    healthText = this.add.text(16, 44, 'Health: 100', { fontSize: '22px', fill: '#e33' });
    weaponText = this.add.text(16, 72, 'Weapon: Pistol', { fontSize: '22px', fill: '#fff' });
    ammoText = this.add.text(16, 100, 'Ammo: 20', { fontSize: '22px', fill: '#fff' });

    // Input
    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', () => playerShoot(this));
    weaponKeys.forEach((key, i) => {
        this.input.keyboard.on('keydown-' + key, () => switchWeapon(i));
    });

    // Collisions
    this.physics.add.overlap(bullets, enemies, bulletHitsEnemy, null, this);
    this.physics.add.overlap(enemyBullets, player, bulletHitsPlayer, null, this);
    this.physics.add.overlap(player, pickups, collectPickup, null, this);

    // Explosion pool
    for (let i = 0; i < 5; i++) {
        let exp = this.add.sprite(-100, -100, 'explosion').setScale(3);
        exp.setVisible(false);
        explosions.add(exp);
    }
}

function update(time, delta) {
    if (isGameOver) return;

    // Player movement
    player.setVelocity(0);
    if (cursors.left.isDown) player.setVelocityX(-200);
    if (cursors.right.isDown) player.setVelocityX(200);
    if (cursors.up.isDown) player.setVelocityY(-200);
    if (cursors.down.isDown) player.setVelocityY(200);

    // Enemy AI and shooting
    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        let dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
        if (dist < ENEMY_CHASE_DIST) {
            this.physics.moveToObject(enemy, player, ENEMY_SPEED + 30);
        } else {
            enemy.setVelocityX(enemy.x < 100 ? ENEMY_SPEED : (enemy.x > 860 ? -ENEMY_SPEED : enemy.body.velocity.x));
        }
        if (time > lastEnemyFire + ENEMY_FIRE_INTERVAL && dist < 300) {
            fireEnemyBullet(enemy, this);
        }
    });
    if (time > lastEnemyFire + ENEMY_FIRE_INTERVAL) lastEnemyFire = time;

    // Update UI
    healthText.setText('Health: ' + player.health);
    scoreText.setText('Score: ' + score);
    weaponText.setText('Weapon: ' + weapons[weaponIndex].name);
    ammoText.setText('Ammo: ' + playerAmmo[weapons[weaponIndex].ammoKey]);
}

// Player shooting
function playerShoot(scene) {
    if (isGameOver) return;
    let weapon = weapons[weaponIndex];
    if (playerAmmo[weapon.ammoKey] <= 0) return;
    let now = scene.time.now;
    if (now < lastFired + weapon.fireRate) return;
    lastFired = now;
    playerAmmo[weapon.ammoKey]--;
    ammoText.setText('Ammo: ' + playerAmmo[weapon.ammoKey]);
    scene.sound.play(weapon.sound);

    if (weapon.key === 'shotgun') {
        for (let angle = -15; angle <= 15; angle += 15) {
            let bullet = bullets.create(player.x, player.y - 30, 'shotgun_bullet');
            scene.physics.velocityFromAngle(-90 + angle, 400, bullet.body.velocity);
            bullet.damage = weapon.damage;
            bullet.range = weapon.range;
            bullet.startY = player.y;
        }
    } else if (weapon.key === 'grenade') {
        let grenade = bullets.create(player.x, player.y - 30, 'grenade');
        grenade.damage = weapon.damage;
        grenade.range = weapon.range;
        grenade.startY = player.y;
        grenade.body.velocity.y = -250;
        grenade.body.velocity.x = Phaser.Math.Between(-80, 80);
        scene.time.delayedCall(800, () => explodeGrenade(grenade, scene));
    } else {
        let bullet = bullets.create(player.x, player.y - 30, 'bullet');
        bullet.body.velocity.y = -500;
        bullet.damage = weapon.damage;
        bullet.range = weapon.range;
        bullet.startY = player.y;
    }
}

function switchWeapon(i) {
    weaponIndex = i;
    weaponText.setText('Weapon: ' + weapons[weaponIndex].name);
    ammoText.setText('Ammo: ' + playerAmmo[weapons[weaponIndex].ammoKey]);
}

// Enemy shooting
function fireEnemyBullet(enemy, scene) {
    if (!enemy.active) return;
    let bullet = enemyBullets.create(enemy.x, enemy.y + 20, 'bullet');
    scene.physics.moveToObject(bullet, player, ENEMY_BULLET_SPEED);
    bullet.damage = 15;
}

// Bullet hits enemy
function bulletHitsEnemy(bullet, enemy) {
    if (!enemy.active) return;
    bullet.destroy();
    scene.sound.play('hit');
    enemy.health -= bullet.damage || 20;
    enemy.setTint(0xff4444);
    setTimeout(() => enemy.clearTint(), 150);
    if (enemy.health <= 0) {
        killEnemy(enemy, this);
    }
}

// Bullet hits player
function bulletHitsPlayer(player, bullet) {
    bullet.destroy();
    if (isGameOver) return;
    player.health -= bullet.damage || 10;
    player.setTint(0xff2222);
    this.sound.play('hit');
    setTimeout(() => player.clearTint(), 120);
    if (player.health <= 0) {
        endGame(this, false);
    }
}

// Grenade explosion
function explodeGrenade(grenade, scene) {
    if (!grenade.active) return;
    let exp = explosions.getFirstDead();
    if (exp) {
        exp.setPosition(grenade.x, grenade.y);
        exp.setVisible(true);
        scene.sound.play('explosion_sound');
        scene.time.delayedCall(400, () => exp.setVisible(false));
    }
    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        let dist = Phaser.Math.Distance.Between(grenade.x, grenade.y, enemy.x, enemy.y);
        if (dist < 60) {
            enemy.health -= weapons[2].damage;
            enemy.setTint(0xffcc00);
            setTimeout(() => enemy.clearTint(), 200);
            if (enemy.health <= 0) killEnemy(enemy, scene);
        }
    });
    grenade.destroy();
}

// Kill enemy
function killEnemy(enemy, scene) {
    enemy.destroy();
    score += 25;
    scoreText.setText('Score: ' + score);
    scene.sound.play('explosion_sound');
    if (Phaser.Math.Between(0, 1) === 1) {
        spawnPickup(scene, enemy.x, enemy.y);
    }
    if (enemies.countActive(true) === 0) {
        endGame(scene, true);
    }
}

// Spawn enemies
function spawnEnemies(scene) {
    for (let i = 0; i < MAX_ENEMIES; i++) {
        let x = 120 + i * 100;
        let y = 90 + Phaser.Math.Between(-20, 50);
        let enemy = enemies.create(x, y, 'enemy').setScale(0.7);
        enemy.setCollideWorldBounds(true);
        enemy.setVelocityX((i % 2 === 0 ? 1 : -1) * ENEMY_SPEED);
        enemy.health = ENEMY_HEALTH;
    }
}

// Pickups
function spawnPickup(scene, x, y) {
    let type = pickupTypes[Phaser.Math.Between(0, pickupTypes.length - 1)];
    let sprite = type === 'health' ? 'pickup_health' : 'pickup_ammo';
    let pickup = pickups.create(x, y, sprite);
    pickup.type = type;
}

// Collect pickup
function collectPickup(player, pickup) {
    if (pickup.type === 'health') {
        player.health = Math.min(playerMaxHealth, player.health + 30);
    } else {
        playerAmmo.pistol += 7;
        playerAmmo.shotgun += 2;
        playerAmmo.grenade += 1;
    }
    pickup.destroy();
    this.sound.play('pickup');
}

// End game
function endGame(scene, win) {
    isGameOver = true;
    let msg = win ? 'You Win!' : 'Game Over!';
    scene.add.text(390, 300, msg, { fontSize: '48px', fill: '#fff', backgroundColor: '#000' });
    scene.add.text(400, 360, 'Refresh to play again!', { fontSize: '28px', fill: '#aaa' });
}
