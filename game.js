const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 640,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let player, cursors, bullets, enemies, enemyBullets, pickups, explosions, obstacles, bandages;
let lastFired = 0, weaponIndex = 0, isReloading = false, reloadProgress = 0;
let score = 0, scoreText, healthText, weaponText, ammoText, reloadText, statusText;
let playerHealth = 100, playerMaxHealth = 100;
let playerBleeding = false, bleedTimer = 0;
let playerAmmo = {
    pistol: {mag: 12, reserve: 48}, 
    shotgun: {mag: 5, reserve: 15}, 
    grenade: {mag: 1, reserve: 3}
};
let weapons = [
    {name: 'Pistol', key: 'pistol', damage: 20, fireRate: 350, magSize: 12, reloadTime: 1400, recoil: 0.03, sound: 'pistol', range: 700},
    {name: 'Shotgun', key: 'shotgun', damage: 40, fireRate: 900, magSize: 5, reloadTime: 1900, recoil: 0.07, sound: 'shotgun', range: 400},
    {name: 'Grenade', key: 'grenade', damage: 80, fireRate: 2000, magSize: 1, reloadTime: 2200, recoil: 0.12, sound: 'grenade', range: 500}
];
let weaponKeys = ['ONE', 'TWO', 'THREE'];
let isGameOver = false;
let pickupTypes = ['health', 'bandage', 'ammo', 'grenade'];
let obstacleTypes = ['barrel', 'box'];
let ENEMY_SPEED = 60;
let ENEMY_FIRE_INTERVAL = 1500;
let ENEMY_CHASE_DIST = 260;
let ENEMY_HEALTH = 60;
let ENEMY_BULLET_SPEED = 220;
let MAX_ENEMIES = 7;

function preload() {
    this.load.image('player', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/phaser-dude.png');
    this.load.image('enemy', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/robot.png');
    this.load.image('bullet', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bullet.png');
    this.load.image('shotgun_bullet', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bullet.png');
    this.load.image('grenade', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bomb.png');
    this.load.image('explosion', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/particles/yellow.png');
    this.load.image('pickup_health', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/health.png');
    this.load.image('pickup_ammo', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/ammo.png');
    this.load.image('pickup_bandage', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/purple_ball.png');
    this.load.image('pickup_grenade', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bomb.png');
    this.load.image('bg', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/skies/space3.png');
    this.load.image('barrel', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/barrel.png');
    this.load.image('box', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/crate.png');
    // Sounds
    this.load.audio('pistol', 'https://cdn.pixabay.com/audio/2022/10/16/audio_12b9c1fd2f.mp3');
    this.load.audio('shotgun', 'https://cdn.pixabay.com/audio/2022/10/16/audio_12b9c1fd2f.mp3');
    this.load.audio('grenade', 'https://cdn.pixabay.com/audio/2022/10/16/audio_12b9c1fd2f.mp3');
    this.load.audio('reload', 'https://cdn.pixabay.com/audio/2022/03/15/audio_115bcead7c.mp3');
    this.load.audio('hit', 'https://cdn.pixabay.com/audio/2022/03/15/audio_115bcead7c.mp3');
    this.load.audio('pickup', 'https://cdn.pixabay.com/audio/2022/03/15/audio_115bcead7c.mp3');
    this.load.audio('explosion_sound', 'https://cdn.pixabay.com/audio/2022/03/15/audio_115bcead7c.mp3');
    this.load.audio('footstep', 'https://cdn.pixabay.com/audio/2022/03/15/audio_115bcead7c.mp3');
}

function create() {
    this.add.image(480, 320, 'bg').setScale(1.3);

    player = this.physics.add.sprite(480, 580, 'player').setScale(0.7);
    player.setCollideWorldBounds(true);
    player.health = playerMaxHealth;
    player.bleeding = false;

    bullets = this.physics.add.group();
    enemyBullets = this.physics.add.group();
    enemies = this.physics.add.group();
    pickups = this.physics.add.group();
    explosions = this.add.group();
    obstacles = this.physics.add.staticGroup();
    bandages = this.physics.add.group();

    spawnObstacles(this);
    spawnEnemies(this);

    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff' });
    healthText = this.add.text(16, 44, 'Health: 100', { fontSize: '22px', fill: '#e33' });
    weaponText = this.add.text(16, 72, 'Weapon: Pistol', { fontSize: '22px', fill: '#fff' });
    ammoText = this.add.text(16, 100, 'Ammo: 12/48', { fontSize: '22px', fill: '#fff' });
    reloadText = this.add.text(16, 128, '', { fontSize: '22px', fill: '#ff0' });
    statusText = this.add.text(16, 156, '', { fontSize: '20px', fill: '#aaf' });

    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', () => playerShoot(this));
    this.input.keyboard.on('keydown-R', () => reloadWeapon(this));
    weaponKeys.forEach((key, i) => {
        this.input.keyboard.on('keydown-' + key, () => switchWeapon(i));
    });
    this.input.keyboard.on('keydown-B', () => useBandage(this));

    this.physics.add.collider(player, obstacles);
    this.physics.add.collider(enemies, obstacles);
    this.physics.add.overlap(bullets, enemies, bulletHitsEnemy, null, this);
    this.physics.add.collider(bullets, obstacles, bulletHitsObstacle, null, this);
    this.physics.add.overlap(enemyBullets, player, bulletHitsPlayer, null, this);
    this.physics.add.collider(enemyBullets, obstacles, bulletHitsObstacle, null, this);
    this.physics.add.overlap(player, pickups, collectPickup, null, this);
    this.physics.add.overlap(player, bandages, collectBandage, null, this);

    for (let i = 0; i < 6; i++) {
        let exp = this.add.sprite(-100, -100, 'explosion').setScale(3);
        exp.setVisible(false);
        explosions.add(exp);
    }
}

function update(time, delta) {
    if (isGameOver) return;

    // Player movement and animation
    let velocity = {x: 0, y: 0};
    if (cursors.left.isDown) velocity.x = -220;
    if (cursors.right.isDown) velocity.x = 220;
    if (cursors.up.isDown) velocity.y = -220;
    if (cursors.down.isDown) velocity.y = 220;
    player.setVelocity(velocity.x, velocity.y);

    if (velocity.x !== 0 || velocity.y !== 0) {
        if (time % 16 < 8) this.sound.play('footstep');
        player.play('walk', true);
    } else {
        player.play('idle', true);
    }

    // Bleeding logic
    if (player.bleeding) {
        if (time > bleedTimer + 1200) {
            player.health -= 2;
            bleedTimer = time;
            statusText.setText('Bleeding! Press B to bandage');
        }
    } else {
        statusText.setText('');
    }

    // Enemy AI: patrol, chase, alert
    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        let dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
        if (enemy.alerted || dist < ENEMY_CHASE_DIST) {
            this.physics.moveToObject(enemy, player, ENEMY_SPEED + 30);
            enemy.alerted = true;
        } else {
            enemy.setVelocityX(enemy.x < 100 ? ENEMY_SPEED : (enemy.x > 860 ? -ENEMY_SPEED : enemy.body.velocity.x));
        }
        // Shoot only if line of sight (no obstacles)
        if (enemy.alerted && time > enemy.lastFire + ENEMY_FIRE_INTERVAL) {
            if (canSeeTarget(enemy, player, obstacles)) {
                fireEnemyBullet(enemy, this);
                enemy.lastFire = time;
            }
        }
    });

    // Update UI
    healthText.setText('Health: ' + player.health);
    let ammo = playerAmmo[weapons[weaponIndex].key];
    ammoText.setText('Ammo: ' + ammo.mag + '/' + ammo.reserve);

    // Reload logic
    if (isReloading) {
        reloadProgress += delta;
        reloadText.setText('Reloading...');
        if (reloadProgress > weapons[weaponIndex].reloadTime) {
            finishReload();
        }
    } else {
        reloadText.setText('');
    }
}

function playerShoot(scene) {
    if (isGameOver || isReloading) return;
    let weapon = weapons[weaponIndex];
    let ammo = playerAmmo[weapon.key];
    let now = scene.time.now;
    if (now < lastFired + weapon.fireRate) return;
    if (ammo.mag <= 0) {
        reloadWeapon(scene);
        return;
    }
    lastFired = now;
    ammo.mag--;
    scene.sound.play(weapon.sound);

    if (weapon.key === 'shotgun') {
        for (let angle = -18; angle <= 18; angle += 18) {
            let bullet = bullets.create(player.x, player.y - 30, 'shotgun_bullet');
            let spread = angle + Phaser.Math.Between(-5, 5);
            scene.physics.velocityFromAngle(-90 + spread, 400, bullet.body.velocity);
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
        scene.time.delayedCall(900, () => explodeGrenade(grenade, scene));
    } else {
        let bullet = bullets.create(player.x, player.y - 30, 'bullet');
        let recoilAngle = Phaser.Math.Between(-weapon.recoil*100, weapon.recoil*100);
        scene.physics.velocityFromAngle(-90 + recoilAngle, 500, bullet.body.velocity);
        bullet.damage = weapon.damage;
        bullet.range = weapon.range;
        bullet.startY = player.y;
    }
}

function reloadWeapon(scene) {
    if (isReloading || isGameOver) return;
    let weapon = weapons[weaponIndex];
    let ammo = playerAmmo[weapon.key];
    if (ammo.mag === weapon.magSize || ammo.reserve === 0) return;
    isReloading = true;
    reloadProgress = 0;
    scene.sound.play('reload');
}

function finishReload() {
    let weapon = weapons[weaponIndex];
    let ammo = playerAmmo[weapon.key];
    let load = Math.min(weapon.magSize - ammo.mag, ammo.reserve);
    ammo.mag += load;
    ammo.reserve -= load;
    isReloading = false;
    reloadProgress = 0;
}

function switchWeapon(i) {
    if (isReloading) return;
    weaponIndex = i;
    weaponText.setText('Weapon: ' + weapons[weaponIndex].name);
}

function useBandage(scene) {
    if (isGameOver || !player.bleeding) return;
    player.bleeding = false;
    statusText.setText('');
    scene.sound.play('pickup');
}

function fireEnemyBullet(enemy, scene) {
    let bullet = enemyBullets.create(enemy.x, enemy.y + 20, 'bullet');
    let angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y) * 180 / Math.PI;
    scene.physics.velocityFromAngle(angle, ENEMY_BULLET_SPEED, bullet.body.velocity);
    bullet.damage = 13;
}

function bulletHitsEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.health -= bullet.damage || 20;
    enemy.setTint(0xff4444);
    setTimeout(() => enemy.clearTint(), 150);
    if (enemy.health <= 0) {
        killEnemy(enemy, this);
    } else if (Phaser.Math.Between(0, 1) === 1) {
        enemy.alerted = true;
    }
}

function bulletHitsPlayer(player, bullet) {
    bullet.destroy();
    if (isGameOver) return;
    player.health -= bullet.damage || 10;
    player.setTint(0xff2222);
    this.sound.play('hit');
    setTimeout(() => player.clearTint(), 120);
    if (Phaser.Math.Between(0,2) === 2 && !player.bleeding) {
        player.bleeding = true;
        bleedTimer = this.time.now;
    }
    if (player.health <= 0) {
        endGame(this, false);
    }
}

function bulletHitsObstacle(bullet, obstacle) {
    if (obstacle.texture.key === 'barrel') {
        let exp = explosions.getFirstDead();
        if (exp) {
            exp.setPosition(obstacle.x, obstacle.y);
            exp.setVisible(true);
            this.sound.play('explosion_sound');
            this.time.delayedCall(400, () => exp.setVisible(false));
        }
        enemies.getChildren().forEach(enemy => {
            let dist = Phaser.Math.Distance.Between(obstacle.x, obstacle.y, enemy.x, enemy.y);
            if (dist < 60) killEnemy(enemy, this);
        });
        obstacle.destroy();
    }
    bullet.destroy();
}

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

function spawnEnemies(scene) {
    for (let i = 0; i < MAX_ENEMIES; i++) {
        let x = 120 + i * 100;
        let y = 90 + Phaser.Math.Between(-20, 50);
        let enemy = enemies.create(x, y, 'enemy').setScale(0.7);
        enemy.setCollideWorldBounds(true);
        enemy.setVelocityX((i % 2 === 0 ? 1 : -1) * ENEMY_SPEED);
        enemy.health = ENEMY_HEALTH;
        enemy.lastFire = 0;
        enemy.alerted = false;
    }
}

function spawnObstacles(scene) {
    // Barrels
    for (let i = 0; i < 4; i++) {
        obstacles.create(Phaser.Math.Between(120, 840), Phaser.Math.Between(240, 500), 'barrel').setScale(0.7);
    }
    // Crates/boxes
    for (let i = 0; i < 5; i++) {
        obstacles.create(Phaser.Math.Between(120, 840), Phaser.Math.Between(160, 540), 'box').setScale(0.7);
    }
}

function spawnPickup(scene, x, y) {
    let type = pickupTypes[Phaser.Math.Between(0, pickupTypes.length - 1)];
    let sprite;
    switch(type) {
        case 'health': sprite = 'pickup_health'; break;
        case 'ammo': sprite = 'pickup_ammo'; break;
        case 'bandage': sprite = 'pickup_bandage'; break;
        case 'grenade': sprite = 'pickup_grenade'; break;
    }
    let pickup = pickups.create(x, y, sprite);
    pickup.type = type;
}

function collectPickup(player, pickup) {
    switch(pickup.type) {
        case 'health':
            player.health = Math.min(playerMaxHealth, player.health + 30);
            break;
        case 'ammo':
            playerAmmo.pistol.reserve += 12;
            playerAmmo.shotgun.reserve += 3;
            playerAmmo.grenade.reserve += 1;
            break;
        case 'bandage':
            bandages.create(pickup.x, pickup.y, 'pickup_bandage');
            break;
        case 'grenade':
            playerAmmo.grenade.reserve += 1;
            break;
    }
    pickup.destroy();
    this.sound.play('pickup');
}

function collectBandage(player, bandage) {
    player.bleeding = false;
    bandage.destroy();
    statusText.setText('');
    this.sound.play('pickup');
}

function canSeeTarget(shooter, target, obstacles) {
    let ray = new Phaser.Geom.Line(shooter.x, shooter.y, target.x, target.y);
    let blocked = false;
    obstacles.getChildren().forEach(obj => {
        if (Phaser.Geom.Intersects.RectangleToLine(obj.getBounds(), ray)) blocked = true;
    });
    return !blocked;
}

function endGame(scene, win) {
    isGameOver = true;
    let msg = win ? 'You Win!' : 'Game Over!';
    scene.add.text(390, 300, msg, { fontSize: '48px', fill: '#fff', backgroundColor: '#000' });
    scene.add.text(400, 360, 'Refresh to play again!', { fontSize: '28px', fill: '#aaa' });
}
