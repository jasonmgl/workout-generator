import type { ExerciseText } from '../../../library/types';

export const SHOULDERS_FR: Readonly<Record<string, ExerciseText>> = {
    // Poussée verticale au poids du corps
    'incline-pike-push-up': {
        name: 'Pompes piquées mains surélevées',
        aliases: ['Pompes piquées inclinées', 'Incline pike push-up'],
        summary: 'La version douce des pompes piquées, mains sur un support : elle apprend à pousser au-dessus de la tête avec moins de poids sur les épaules.',
        setup: [
            'Placer une chaise contre un mur pour qu’elle ne glisse pas, ou se mettre face à une marche.',
            'Poser les mains sur le bord, écartées de la largeur des épaules.',
            'Reculer les pieds puis monter les hanches, jambes tendues ou un peu fléchies : le corps forme un V à l’envers.',
        ],
        steps: [
            'Plier les coudes pour amener le sommet du crâne vers le bord du support, un peu devant les mains.',
            'S’arrêter quand la tête frôle le support.',
            'Pousser pour revenir bras tendus, les hanches toujours hautes.',
        ],
        cues: [
            'Garder les hanches hautes, au-dessus des mains.',
            'Diriger les coudes vers l’arrière, pas sur les côtés.',
            'Former un triangle entre les deux mains et la tête en bas du mouvement.',
        ],
        mistakes: [
            'Laisser les hanches descendre : l’exercice devient une pompe inclinée.',
            'Ouvrir les coudes en T.',
            'Descendre à moitié.',
        ],
        breathing: 'Inspirer en descendant, souffler en poussant.',
    },
    'pike-push-up': {
        name: 'Pompes piquées',
        aliases: ['Pompes piquées', 'Pike push-up', 'Pompes en V'],
        summary: 'Une pompe les hanches en l’air, qui fait pousser vers le haut : épaules et triceps, sans matériel, en préparation des pompes en équilibre.',
        setup: [
            'Se mettre en position de pompe, mains un peu plus larges que les épaules.',
            'Rapprocher les pieds des mains en montant les hanches, jusqu’à former un V à l’envers.',
            'Garder les jambes tendues, ou un peu fléchies si l’arrière des cuisses tire.',
        ],
        steps: [
            'Plier les coudes pour descendre le sommet du crâne vers le sol, un peu devant les mains.',
            'S’arrêter quand la tête frôle le sol.',
            'Pousser le sol pour revenir bras tendus, sans baisser les hanches.',
        ],
        cues: [
            'Garder le poids du corps sur les mains, les hanches hautes.',
            'Envoyer les coudes vers l’arrière, à environ 45° du buste.',
            'Former un triangle entre les deux mains et la tête.',
        ],
        mistakes: [
            'Laisser les hanches descendre et revenir à une pompe classique.',
            'Écarter les coudes sur les côtés.',
            'Descendre la tête entre les mains plutôt que devant.',
        ],
        breathing: 'Inspirer en descendant, souffler en poussant.',
    },
    'wall-walk': {
        name: 'Montées au mur',
        aliases: ['Wall walk', 'Montée au mur', 'Marche des mains au mur'],
        summary: 'Partir à plat ventre et monter les pieds le long du mur en rapprochant les mains : épaules, triceps et gainage, en route vers l’équilibre sur les mains.',
        setup: [
            'Dégager le sol autour de soi, puis s’allonger à plat ventre, la plante des pieds contre le mur.',
            'Poser les mains au sol à hauteur de la poitrine, comme pour une pompe.',
        ],
        steps: [
            'Pousser jusqu’aux bras tendus et poser les pointes de pieds sur le mur.',
            'Monter les pieds le long du mur tout en reculant les mains vers lui, par petits pas.',
            'S’arrêter quand les mains sont à une ou deux largeurs de main du mur, le corps presque vertical, ventre face au mur.',
            'Redescendre de la même façon, sans se précipiter, jusqu’à la position de départ.',
        ],
        cues: [
            'Pousser le sol, bras tendus, les épaules près des oreilles.',
            'Serrer les fessiers et le ventre pour garder le corps d’un seul bloc.',
            'Déplacer les mains par petits pas, une à la fois.',
        ],
        mistakes: [
            'Creuser le dos en montant.',
            'Plier les bras en déplaçant les mains.',
            'Monter plus près du mur que ce que l’on sait redescendre.',
        ],
        breathing: 'Souffler par petites expirations pendant la montée, sans bloquer la respiration.',
        safety: 'À éviter avec une hypertension mal contrôlée ou un glaucome ; en cas de fatigue, redescendre aussitôt en éloignant les mains du mur.',
    },
    'elevated-pike-push-up': {
        name: 'Pompes piquées pieds surélevés',
        aliases: ['Pompes piquées pieds surélevés', 'Elevated pike push-up', 'Pompes piquées déclinées'],
        summary: 'Les pompes piquées avec les pieds sur une chaise : le buste se rapproche de la verticale et les épaules portent presque tout le poids du corps.',
        setup: [
            'Placer une chaise ou un banc stable contre un mur.',
            'Poser les pieds sur le support, mains au sol à la largeur des épaules.',
            'Rapprocher les mains du support et monter les hanches jusqu’à ce qu’elles soient presque au-dessus des épaules, le dos plat.',
        ],
        steps: [
            'Plier les coudes pour descendre la tête vers le sol, un peu devant les mains.',
            'Effleurer le sol du sommet du crâne.',
            'Pousser fort pour revenir bras tendus, les hanches toujours au-dessus des mains.',
        ],
        cues: [
            'Garder les coudes vers l’arrière, à environ 45° du buste.',
            'Finir chaque poussée en grandissant les épaules vers les oreilles.',
            'Gainer le ventre pour ne pas creuser le dos.',
        ],
        mistakes: [
            'Laisser les hanches reculer et le buste s’incliner.',
            'Ouvrir les coudes en T.',
            'Choisir un support qui glisse ou bascule.',
        ],
        breathing: 'Inspirer en descendant, souffler en poussant.',
    },
    'wall-handstand-push-up-negative': {
        name: 'Pompes en équilibre négatives contre le mur',
        aliases: ['HSPU négatives', 'Négatives de pompes en équilibre', 'Descentes en équilibre contre le mur'],
        summary: 'La descente seule d’une pompe en équilibre, freinée sur plusieurs secondes : l’étape qui construit la force de remonter.',
        setup: [
            'Poser un coussin plié ou un tapis plié au pied du mur.',
            'Monter en équilibre contre le mur, dos au mur par un lancer de jambe ou ventre au mur en marchant des mains.',
            'Placer les mains à la largeur des épaules, bras tendus, corps gainé.',
        ],
        steps: [
            'Plier les coudes lentement, sur trois à cinq secondes, pour descendre la tête vers le sol.',
            'Poser doucement le sommet du crâne sur le coussin, un peu devant les mains.',
            'Redescendre les pieds au sol, se relever, puis remonter pour la répétition suivante.',
        ],
        cues: [
            'Freiner jusqu’au bout : la vitesse de descente reste la même du début à la fin.',
            'Garder les coudes vers l’arrière, pas en T.',
            'Former un triangle entre les deux mains et la tête.',
        ],
        mistakes: [
            'Se laisser tomber sur la fin de la descente.',
            'Écarter les coudes sur les côtés.',
            'Creuser le dos, le ventre relâché.',
        ],
        breathing: 'Inspirer en haut, souffler doucement pendant la descente.',
        safety: 'À éviter avec une douleur à la nuque, une hypertension mal contrôlée ou un glaucome ; arrêter si la tête tourne.',
    },
    'wall-handstand-push-up': {
        name: 'Pompes en équilibre contre le mur',
        aliases: ['HSPU', 'Handstand push-up', 'Pompes en équilibre', 'Pompes en poirier contre le mur'],
        summary: 'La pompe tête en bas, pieds au mur : la poussée verticale la plus lourde au poids du corps, pour les épaules et les triceps.',
        setup: [
            'Poser un coussin plié ou un tapis plié au pied du mur.',
            'Monter en équilibre contre le mur, mains à la largeur des épaules, à une ou deux largeurs de main du mur si le dos est au mur.',
            'Tendre les bras et gainer tout le corps.',
        ],
        steps: [
            'Descendre en pliant les coudes jusqu’à ce que le sommet du crâne effleure le coussin, un peu devant les mains.',
            'Pousser le sol pour remonter jusqu’aux bras tendus.',
            'Grandir les épaules vers les oreilles en haut, avant la répétition suivante.',
        ],
        cues: [
            'Garder les coudes vers l’arrière, à environ 45° du buste.',
            'Serrer fessiers et ventre : les talons glissent sur le mur sans que le dos se creuse.',
            'Ramener la tête entre les bras en fin de poussée.',
        ],
        mistakes: [
            'Se laisser tomber sur la tête en bas du mouvement.',
            'Cambrer fort pour s’aider du mur.',
            'Enchaîner des demi-répétitions sans descendre.',
        ],
        breathing: 'Inspirer en descendant, souffler en poussant.',
        safety: 'À éviter avec une douleur à la nuque, une hypertension mal contrôlée ou un glaucome ; arrêter si la tête tourne.',
    },

    // Développés avec charge
    'band-overhead-press': {
        name: 'Développé épaules à l’élastique',
        aliases: ['Développé militaire à l’élastique', 'Band overhead press'],
        summary: 'Pousser un élastique au-dessus de la tête depuis les épaules : épaules et triceps, avec une résistance qui augmente en haut du mouvement.',
        setup: [
            'Se tenir debout sur le milieu de l’élastique, pieds à la largeur des hanches.',
            'Prendre une extrémité dans chaque main et monter les mains à hauteur d’épaules, paumes vers l’avant, coudes sous les poignets.',
        ],
        steps: [
            'Pousser les mains vers le haut jusqu’aux bras tendus au-dessus de la tête.',
            'Marquer un court temps en haut.',
            'Redescendre en contrôlant jusqu’aux épaules.',
        ],
        cues: [
            'Serrer les fessiers et le ventre pour ne pas cambrer.',
            'Finir les bras près des oreilles, les poignets au-dessus des épaules.',
            'Garder les poignets droits.',
        ],
        mistakes: [
            'Creuser le bas du dos en poussant.',
            'Pousser vers l’avant au lieu de la verticale.',
            'Laisser l’élastique ramener les mains d’un coup.',
        ],
        breathing: 'Souffler en poussant, inspirer en redescendant.',
    },
    'seated-dumbbell-press': {
        name: 'Développé épaules assis aux haltères',
        aliases: ['Développé assis aux haltères', 'Développé militaire assis', 'Seated dumbbell press'],
        summary: 'Le développé aux haltères assis, le dos calé : épaules et triceps, sans que les jambes puissent aider.',
        setup: [
            'S’asseoir sur un banc ou une chaise solide, pieds à plat, le dos droit contre le dossier si possible.',
            'Amener les haltères à hauteur d’épaules, paumes vers l’avant, coudes un peu en avant du buste.',
        ],
        steps: [
            'Pousser les haltères vers le haut jusqu’aux bras presque tendus, au-dessus de la tête.',
            'Redescendre lentement jusqu’à ce que les haltères reviennent à hauteur d’épaules.',
        ],
        cues: [
            'Garder les avant-bras verticaux, les poignets au-dessus des coudes.',
            'Rapprocher les haltères en haut sans les entrechoquer.',
            'Garder le dos en contact avec le dossier, sans cambrer.',
        ],
        mistakes: [
            'Cambrer en décollant le dos du dossier.',
            'Descendre les coudes très bas, loin derrière le buste.',
            'Prendre une charge qui oblige à pousser par à-coups.',
        ],
        breathing: 'Souffler en poussant, inspirer en redescendant.',
    },
    'dumbbell-overhead-press': {
        name: 'Développé épaules debout aux haltères',
        aliases: ['Développé militaire aux haltères', 'Développé haltères debout', 'Dumbbell overhead press', 'Shoulder press'],
        summary: 'Pousser deux haltères au-dessus de la tête, debout : épaules et triceps, avec le tronc gainé pour tenir la position.',
        setup: [
            'Se tenir debout, pieds à la largeur des hanches, genoux souples.',
            'Amener les haltères à hauteur d’épaules, paumes vers l’avant ou face à face, coudes un peu en avant du buste.',
        ],
        steps: [
            'Pousser les haltères à la verticale jusqu’aux bras tendus, près des oreilles.',
            'Marquer un bref temps en haut.',
            'Redescendre en contrôlant jusqu’aux épaules.',
        ],
        cues: [
            'Serrer fessiers et ventre : les côtes restent basses.',
            'Garder les avant-bras verticaux pendant toute la poussée.',
            'Finir avec les haltères au-dessus des épaules, pas devant.',
        ],
        mistakes: [
            'Cambrer le bas du dos pour finir la poussée.',
            'Plier les genoux pour lancer les haltères.',
            'Pousser les haltères vers l’avant.',
        ],
        breathing: 'Souffler en poussant, inspirer en redescendant.',
    },
    'half-kneeling-dumbbell-press': {
        name: 'Développé un bras, un genou au sol',
        aliases: ['Développé en chevalier servant', 'Développé à un bras, à genou', 'Half-kneeling press'],
        summary: 'Un développé à un bras, un genou au sol : l’épaule pousse pendant que le tronc résiste à la bascule, sans possibilité de cambrer.',
        setup: [
            'Poser un genou au sol sur un coussin, l’autre pied devant, les deux genoux pliés à angle droit.',
            'Tenir l’haltère du côté du genou posé, à hauteur d’épaule, paume vers l’intérieur ou vers l’avant.',
            'Serrer le fessier de la jambe arrière pour grandir le buste.',
        ],
        steps: [
            'Pousser l’haltère vers le haut jusqu’au bras tendu, près de l’oreille.',
            'Redescendre en contrôlant jusqu’à l’épaule.',
            'Faire toutes les répétitions, puis changer de bras et de genou.',
        ],
        cues: [
            'Garder le buste vertical, sans pencher du côté libre.',
            'Garder le fessier arrière serré tout du long.',
            'Finir le poignet au-dessus de l’épaule.',
        ],
        mistakes: [
            'Se pencher sur le côté pour finir la poussée.',
            'Cambrer en avançant le bassin.',
            'Poser le genou sur un sol dur sans protection.',
        ],
        breathing: 'Souffler en poussant, inspirer en redescendant.',
    },
    'arnold-press': {
        name: 'Développé Arnold',
        aliases: ['Arnold press', 'Développé Arnold assis'],
        summary: 'Un développé aux haltères avec une rotation des mains en chemin : une grande amplitude, pour l’avant et le côté de l’épaule.',
        setup: [
            'S’asseoir sur un banc ou une chaise solide, le dos droit, pieds à plat.',
            'Tenir les haltères devant les épaules, paumes vers soi, coudes devant le buste, comme en haut d’un curl.',
        ],
        steps: [
            'Pousser vers le haut en écartant les coudes et en tournant les paumes vers l’avant.',
            'Finir bras tendus au-dessus de la tête, paumes vers l’avant.',
            'Redescendre par le même chemin en ramenant les paumes vers soi.',
        ],
        cues: [
            'Tourner les mains pendant la poussée, pas avant ni après.',
            'Garder le dos droit, les côtes basses.',
            'Contrôler la descente.',
        ],
        mistakes: [
            'Tourner les mains une fois en haut, après la poussée.',
            'Cambrer pour finir le mouvement.',
            'Prendre trop lourd et perdre la rotation.',
        ],
        breathing: 'Souffler en poussant, inspirer en redescendant.',
    },
    'one-arm-kettlebell-press': {
        name: 'Développé à la kettlebell à un bras',
        aliases: ['Développé kettlebell', 'Développé un bras au kettlebell', 'Kettlebell press', 'Strict press à la kettlebell'],
        summary: 'Pousser une kettlebell au-dessus de la tête d’un seul bras : l’épaule et le triceps poussent, le tronc se gaine pour ne pas pencher.',
        setup: [
            'Monter la kettlebell en position de rack, à deux mains si besoin : poignée en main, boule posée sur l’avant-bras, contre la poitrine, coude près du buste.',
            'Se tenir debout, pieds à la largeur des hanches, fessiers et ventre serrés.',
        ],
        steps: [
            'Pousser la kettlebell vers le haut en tournant légèrement la paume vers l’avant.',
            'Finir le bras tendu, le biceps près de l’oreille.',
            'Redescendre en contrôlant jusqu’au rack, puis enchaîner.',
            'Changer de bras à la fin de la série.',
        ],
        cues: [
            'Garder le poignet droit, la boule contre l’avant-bras.',
            'Serrer fort la poignée.',
            'Rester droit, sans se pencher du côté libre.',
        ],
        mistakes: [
            'Casser le poignet vers l’arrière.',
            'Écarter le coude sur le côté au départ.',
            'Se pencher ou cambrer pour finir.',
        ],
        breathing: 'Souffler en poussant, inspirer en redescendant.',
    },
    'barbell-overhead-press': {
        name: 'Développé militaire à la barre',
        aliases: ['Développé militaire', 'Overhead press', 'Military press', 'Strict press'],
        summary: 'Le développé debout à la barre, sortie d’un rack : la grande poussée verticale chargée, pour les épaules, les triceps et le gainage.',
        setup: [
            'Régler les supports du rack à hauteur de poitrine.',
            'Saisir la barre, mains un peu plus écartées que les épaules, poignets droits, coudes légèrement devant la barre.',
            'Sortir du rack d’un pas, pieds à la largeur des hanches, fessiers et ventre serrés.',
        ],
        steps: [
            'Reculer légèrement la tête et pousser la barre à la verticale, au ras du menton.',
            'Une fois la barre passée au-dessus du front, avancer la tête sous la barre.',
            'Finir bras tendus, la barre au-dessus du milieu des pieds.',
            'Redescendre en contrôlant jusqu’au haut de la poitrine.',
        ],
        cues: [
            'Garder les côtes basses : le buste ne part pas en arrière.',
            'Pousser la barre en ligne droite, pas en arc devant soi.',
            'Serrer fort la barre, les poignets au-dessus des coudes.',
        ],
        mistakes: [
            'Cambrer fort pour finir la poussée.',
            'Pousser la barre loin devant le visage.',
            'Plier les genoux pour lancer la barre.',
        ],
        breathing: 'Inspirer et gainer avant de pousser, souffler en fin de poussée.',
        safety: 'Garder une charge qui se pousse sans cambrer ; arrêter en cas de douleur dans le bas du dos ou à l’épaule.',
    },
    'dumbbell-push-press': {
        name: 'Push press aux haltères',
        aliases: ['Push press', 'Développé poussé aux haltères', 'Dumbbell push press'],
        summary: 'Un développé lancé par une petite flexion des jambes : les jambes donnent l’élan, les épaules et les triceps finissent la poussée.',
        setup: [
            'Se tenir debout, pieds à la largeur des hanches.',
            'Tenir les haltères à hauteur d’épaules, paumes face à face, coudes sous les poignets.',
        ],
        steps: [
            'Fléchir légèrement les genoux, buste droit, sans s’asseoir.',
            'Tendre les jambes d’un coup sec et prolonger l’élan en poussant les haltères au-dessus de la tête.',
            'Finir bras tendus et jambes tendues.',
            'Ramener les haltères aux épaules en amortissant avec les genoux.',
        ],
        cues: [
            'Descendre peu et vite, comme un ressort.',
            'Garder le buste vertical pendant la flexion.',
            'Pousser les haltères à la verticale, au-dessus des épaules.',
        ],
        mistakes: [
            'Fléchir trop bas, comme pour un squat.',
            'Pencher le buste en avant pendant la flexion.',
            'Cambrer en fin de poussée.',
        ],
        breathing: 'Inspirer avant la flexion, souffler pendant la poussée.',
    },

    // Élévations
    'wall-isometric-lateral-raise': {
        name: 'Élévation latérale isométrique contre le mur',
        aliases: ['Abduction isométrique de l’épaule', 'Isometric lateral raise'],
        summary: 'Pousser le bras contre un mur sans bouger : un travail doux du milieu de l’épaule, utile pour reprendre quand le mouvement fait encore mal.',
        setup: [
            'Se tenir debout de profil, tout près d’un mur.',
            'Plier le coude à angle droit et poser l’extérieur du bras, juste au-dessus du coude, contre le mur.',
        ],
        steps: [
            'Pousser le bras contre le mur, comme pour l’écarter du corps, sans bouger.',
            'Tenir la poussée à intensité modérée pendant toute la durée.',
            'Relâcher doucement, puis changer de côté.',
        ],
        cues: [
            'Garder l’épaule basse, loin de l’oreille.',
            'Doser la poussée : environ la moitié de sa force, sans douleur.',
            'Rester droit, sans pencher vers le mur.',
        ],
        mistakes: [
            'Hausser l’épaule.',
            'Pousser par à-coups.',
            'Pousser fort au point d’avoir mal.',
        ],
        breathing: 'Respirer calmement, sans bloquer.',
        safety: 'Rester sous le seuil de la douleur ; une gêne qui augmente pendant la tenue doit faire baisser l’effort.',
    },
    'band-lateral-raise': {
        name: 'Élévations latérales à l’élastique',
        aliases: ['Band lateral raise', 'Élévations latérales élastique'],
        summary: 'Monter les bras sur les côtés contre un élastique : le milieu de l’épaule, avec une résistance qui augmente en haut.',
        setup: [
            'Se tenir debout sur le milieu de l’élastique, pieds à la largeur des hanches.',
            'Prendre une extrémité dans chaque main, bras le long du corps, coudes légèrement fléchis.',
        ],
        steps: [
            'Monter les bras sur les côtés jusqu’à hauteur d’épaules.',
            'Tenir une seconde en haut.',
            'Redescendre lentement, sans laisser l’élastique tirer les bras.',
        ],
        cues: [
            'Mener le mouvement avec les coudes.',
            'Garder les épaules basses, loin des oreilles.',
            'Monter les bras un peu en avant du corps.',
        ],
        mistakes: [
            'Hausser les épaules pour monter.',
            'Monter les mains plus haut que les épaules.',
            'Balancer le buste.',
        ],
        breathing: 'Souffler en montant, inspirer en redescendant.',
    },
    'dumbbell-lateral-raise': {
        name: 'Élévations latérales aux haltères',
        aliases: ['Élévations latérales', 'Lateral raise'],
        summary: 'Monter deux haltères sur les côtés jusqu’à hauteur d’épaules : le travail de base du milieu de l’épaule, celui qui donne de la largeur à la carrure.',
        setup: [
            'Se tenir debout, pieds à la largeur des hanches, un haltère léger dans chaque main.',
            'Laisser pendre les bras le long du corps, coudes légèrement fléchis, buste un peu penché en avant.',
        ],
        steps: [
            'Monter les bras sur les côtés jusqu’à l’horizontale.',
            'Marquer un court temps en haut.',
            'Redescendre en deux à trois secondes.',
        ],
        cues: [
            'Penser à écarter les haltères loin du corps plutôt qu’à les lever.',
            'Garder les épaules basses.',
            'Garder les coudes à la hauteur des poignets, ou un peu au-dessus.',
        ],
        mistakes: [
            'Prendre trop lourd et balancer le buste.',
            'Hausser les épaules vers les oreilles.',
            'Monter bien au-dessus des épaules.',
        ],
        breathing: 'Souffler en montant, inspirer en redescendant.',
    },
    'lean-away-lateral-raise': {
        name: 'Élévations latérales à un bras en appui',
        aliases: ['Lean-away lateral raise', 'Élévations latérales inclinées', 'Élévations latérales à un bras'],
        summary: 'Une élévation latérale à un bras, le corps incliné de côté en se tenant à un montant : le milieu de l’épaule travaille dès le bas du mouvement.',
        setup: [
            'Se tenir de profil, à un pas d’un montant solide : encadrement de porte ou rack.',
            'Saisir le montant d’une main, pieds près de sa base, et laisser le corps s’incliner de côté, bras de soutien tendu.',
            'Tenir un haltère léger dans l’autre main, bras le long du corps, coude à peine fléchi.',
        ],
        steps: [
            'Monter le bras libre sur le côté jusqu’à hauteur d’épaule.',
            'Redescendre lentement jusqu’en bas.',
            'Faire toutes les répétitions, puis changer de côté.',
        ],
        cues: [
            'Garder le corps droit et gainé des pieds à la tête, comme une planche penchée.',
            'Mener le mouvement avec le coude.',
            'Garder l’épaule loin de l’oreille.',
        ],
        mistakes: [
            'Se redresser en montant le bras.',
            'Hausser l’épaule.',
            'Prendre trop lourd.',
        ],
        breathing: 'Souffler en montant, inspirer en redescendant.',
    },
    'band-front-raise': {
        name: 'Élévations frontales à l’élastique',
        aliases: ['Élévations avant à l’élastique', 'Band front raise'],
        summary: 'Monter les bras tendus devant soi contre un élastique : l’avant de l’épaule, sans charge lourde.',
        setup: [
            'Se tenir debout sur le milieu de l’élastique, pieds à la largeur des hanches.',
            'Prendre une extrémité dans chaque main, bras tendus devant les cuisses, paumes vers soi.',
        ],
        steps: [
            'Monter les bras devant soi jusqu’à hauteur d’épaules.',
            'Tenir une seconde.',
            'Redescendre lentement jusqu’aux cuisses.',
        ],
        cues: [
            'Garder les bras presque tendus, les coudes souples.',
            'Garder le buste immobile, le ventre serré.',
            'Garder les épaules basses.',
        ],
        mistakes: [
            'Se pencher en arrière pour monter.',
            'Hausser les épaules.',
            'Laisser l’élastique ramener les bras d’un coup.',
        ],
        breathing: 'Souffler en montant, inspirer en redescendant.',
    },
    'dumbbell-front-raise': {
        name: 'Élévations frontales aux haltères',
        aliases: ['Élévations frontales', 'Élévations avant', 'Front raise'],
        summary: 'Monter les haltères devant soi jusqu’à hauteur d’épaules : un travail isolé de l’avant de l’épaule.',
        setup: [
            'Se tenir debout, pieds à la largeur des hanches, genoux souples.',
            'Tenir les haltères devant les cuisses, paumes vers soi ou face à face.',
        ],
        steps: [
            'Monter les deux bras devant soi, presque tendus, jusqu’à hauteur d’épaules.',
            'Marquer un court temps en haut.',
            'Redescendre lentement jusqu’aux cuisses.',
        ],
        cues: [
            'Garder le buste immobile, sans élan.',
            'Garder les épaules basses.',
            'Contrôler la descente.',
        ],
        mistakes: [
            'Balancer le buste en arrière.',
            'Prendre une charge qui oblige à se cambrer.',
            'Verrouiller les coudes.',
        ],
        breathing: 'Souffler en montant, inspirer en redescendant.',
    },
    'bent-over-rear-delt-fly': {
        name: 'Oiseau aux haltères',
        aliases: ['Oiseau', 'Élévations latérales buste penché', 'Écartés arrière aux haltères', 'Rear delt fly'],
        summary: 'Écarter les haltères sur les côtés, buste penché en avant : l’arrière de l’épaule et le haut du dos, souvent oubliés.',
        setup: [
            'Se tenir debout, pieds à la largeur des hanches, un haltère léger dans chaque main.',
            'Plier les genoux et pencher le buste en avant, dos plat, presque jusqu’à l’horizontale.',
            'Laisser pendre les bras sous les épaules, coudes légèrement fléchis, paumes face à face.',
        ],
        steps: [
            'Écarter les bras sur les côtés jusqu’à ce qu’ils arrivent dans le prolongement des épaules.',
            'Marquer un court temps en haut.',
            'Redescendre lentement sous les épaules.',
        ],
        cues: [
            'Garder le dos plat et immobile tout du long.',
            'Mener avec les coudes, en écartant les bras vers les côtés.',
            'Garder la nuque dans le prolongement du dos.',
        ],
        mistakes: [
            'Se redresser en montant les bras.',
            'Arrondir le dos.',
            'Prendre trop lourd et tirer comme pour un rowing.',
        ],
        breathing: 'Souffler en écartant, inspirer en redescendant.',
        safety: 'Avec un dos sensible, faire l’exercice assis au bord d’une chaise, la poitrine vers les cuisses.',
    },

    // Omoplates et coiffe des rotateurs
    'scapular-push-up': {
        name: 'Pompes scapulaires',
        aliases: ['Scapular push-up', 'Pompes omoplates'],
        summary: 'En position de pompe, bras tendus, seules les omoplates bougent : un échauffement qui réveille le dentelé antérieur et prépare les épaules à pousser.',
        setup: [
            'Se mettre en position de pompe haute, mains sous les épaules, bras tendus.',
            'Gainer le corps des épaules aux chevilles, ou poser les genoux pour commencer.',
        ],
        steps: [
            'Sans plier les coudes, laisser la poitrine descendre entre les épaules en rapprochant les omoplates.',
            'Pousser le sol pour écarter les omoplates et arrondir légèrement le haut du dos.',
            'Enchaîner lentement les deux temps.',
        ],
        cues: [
            'Garder les bras tendus du début à la fin.',
            'Chercher toute l’amplitude des omoplates, sans se presser.',
            'Garder la tête dans le prolongement du corps.',
        ],
        mistakes: [
            'Plier les coudes : ce n’est plus le même exercice.',
            'Laisser le bassin s’affaisser.',
            'Faire un mouvement minuscule et rapide.',
        ],
        breathing: 'Inspirer en rapprochant les omoplates, souffler en poussant.',
    },
    'scapular-dip': {
        name: 'Dips scapulaires',
        aliases: ['Scapular dips', 'Haussements d’épaules inversés aux barres', 'Abaissements d’omoplates aux barres'],
        summary: 'En appui bras tendus aux barres parallèles, monter et descendre le corps par les seules omoplates : le bas des trapèzes et la tenue des épaules, avant les dips.',
        setup: [
            'Se placer entre les barres et monter en appui, bras tendus, mains sous les épaules.',
            'Plier les genoux ou croiser les chevilles pour que les pieds ne touchent pas le sol.',
        ],
        steps: [
            'Sans plier les coudes, laisser le corps descendre de quelques centimètres : les épaules montent vers les oreilles.',
            'Pousser les barres vers le bas pour abaisser les épaules et remonter le corps.',
            'Marquer un court temps en haut, épaules basses, puis enchaîner.',
        ],
        cues: [
            'Garder les bras tendus du début à la fin.',
            'Penser à éloigner les épaules des oreilles en poussant.',
            'Garder le corps immobile, sans balancer les jambes.',
        ],
        mistakes: [
            'Plier les coudes pour descendre plus bas.',
            'Se laisser tomber d’un coup en bas du mouvement.',
            'Balancer les jambes pour remonter.',
        ],
        breathing: 'Inspirer en descendant, souffler en abaissant les épaules.',
        safety: 'Ne pas descendre jusqu’à la gêne ; arrêter si l’avant ou le dessus de l’épaule fait mal.',
    },
    'band-pull-apart': {
        name: 'Pull-apart à l’élastique',
        aliases: ['Band pull-apart', 'Pull apart', 'Écartés arrière à l’élastique'],
        summary: 'Écarter un élastique tenu bras tendus devant soi : l’arrière des épaules et le milieu du dos, pour s’échauffer comme pour la posture.',
        setup: [
            'Se tenir debout, l’élastique tenu à deux mains devant la poitrine, bras tendus à hauteur d’épaules.',
            'Placer les mains à la largeur des épaules, paumes vers le bas.',
        ],
        steps: [
            'Écarter les bras sur les côtés jusqu’à ce que l’élastique touche le haut de la poitrine.',
            'Marquer un court temps en serrant les omoplates.',
            'Revenir lentement devant soi.',
        ],
        cues: [
            'Garder les bras tendus et les épaules basses.',
            'Rapprocher les omoplates sans cambrer.',
            'Rapprocher les mains sur l’élastique pour plus de résistance.',
        ],
        mistakes: [
            'Hausser les épaules.',
            'Plier les coudes pour finir.',
            'Cambrer en avançant les côtes.',
        ],
        breathing: 'Souffler en écartant, inspirer en revenant.',
    },
    'band-face-pull': {
        name: 'Face pull à l’élastique',
        aliases: ['Face pull', 'Tirage visage à l’élastique'],
        summary: 'Tirer vers le visage un élastique fixé devant soi, coudes hauts : arrière des épaules, milieu du dos et coiffe des rotateurs, un bon contrepoids aux heures passées assis.',
        setup: [
            'Fixer l’élastique à hauteur de visage, sur un montant de rack ou dans une porte fermée avec un ancrage.',
            'Prendre une extrémité dans chaque main, paumes vers le bas, et reculer jusqu’à tendre l’élastique, bras tendus devant soi.',
        ],
        steps: [
            'Tirer les mains vers le visage en écartant les coudes sur les côtés, à hauteur d’épaules.',
            'Finir les mains de part et d’autre des oreilles, les poings tournés vers le plafond.',
            'Revenir lentement bras tendus.',
        ],
        cues: [
            'Garder les coudes hauts, au niveau des épaules.',
            'Tourner les avant-bras vers l’arrière en fin de tirage.',
            'Rester droit, sans se pencher en arrière.',
        ],
        mistakes: [
            'Tirer vers le cou ou la poitrine, les coudes bas.',
            'Hausser les épaules.',
            'Se laisser tirer vers l’avant au retour.',
        ],
        breathing: 'Souffler en tirant, inspirer en revenant.',
    },
    'ring-face-pull': {
        name: 'Face pull aux anneaux',
        nameWith: { 'suspension-trainer': 'Face pull aux sangles' },
        aliases: ['Face pull au TRX', 'Face pull aux sangles', 'Ring face pull'],
        summary: 'Le face pull au poids du corps, penché en arrière sous des anneaux ou des sangles : arrière des épaules, milieu du dos et coiffe des rotateurs.',
        setup: [
            'Régler les anneaux ou les sangles à hauteur de poitrine.',
            'Prendre une poignée dans chaque main, paumes vers le bas, et avancer les pieds pour se pencher en arrière, bras tendus.',
            'Gainer le corps des talons à la tête.',
        ],
        steps: [
            'Tirer le corps vers les poignées en écartant les coudes, jusqu’à amener les mains de part et d’autre du front.',
            'Marquer un temps, omoplates serrées.',
            'Revenir lentement bras tendus.',
        ],
        cues: [
            'Garder les coudes à hauteur d’épaules.',
            'Garder le corps droit comme une planche.',
            'Avancer les pieds pour durcir, les reculer pour alléger.',
        ],
        mistakes: [
            'Laisser les hanches s’affaisser.',
            'Tirer les coudes le long du corps, comme pour un rowing.',
            'Se laisser tomber au retour.',
        ],
        breathing: 'Souffler en tirant, inspirer en revenant.',
    },
    'prone-y-t-w': {
        name: 'Y-T-W au sol',
        aliases: ['YTW', 'Prone Y-T-W', 'Élévations Y-T-W allongé'],
        summary: 'Allongé sur le ventre, dessiner les lettres Y, T et W avec les bras : le bas et le milieu des trapèzes, l’arrière des épaules et la posture.',
        setup: [
            'S’allonger sur le ventre, le front posé sur une serviette pliée, jambes tendues.',
            'Serrer légèrement le ventre et les fessiers.',
        ],
        steps: [
            'Y : tendre les bras au-dessus de la tête en V, pouces vers le plafond, les décoller du sol et tenir deux secondes.',
            'T : ouvrir les bras sur les côtés, pouces vers le plafond, les décoller et tenir deux secondes.',
            'W : plier les coudes et les tirer vers les côtes, mains à hauteur d’épaules, les décoller et tenir deux secondes.',
            'Enchaîner les trois lettres : c’est une répétition.',
        ],
        cues: [
            'Décoller les bras de quelques centimètres seulement.',
            'Garder les épaules loin des oreilles.',
            'Garder le front au sol, la nuque longue.',
        ],
        mistakes: [
            'Lever la tête et cambrer pour monter plus haut.',
            'Hausser les épaules.',
            'Passer trop vite d’une lettre à l’autre.',
        ],
        breathing: 'Souffler en décollant les bras, respirer calmement pendant la tenue.',
    },
    'reverse-snow-angel': {
        name: 'Anges des neiges inversés',
        aliases: ['Reverse snow angel', 'Anges inversés'],
        summary: 'Allongé sur le ventre, faire passer les bras décollés des hanches jusqu’au-dessus de la tête : le haut du dos et l’arrière des épaules, en douceur.',
        setup: [
            'S’allonger sur le ventre, jambes tendues, bras le long du corps, paumes vers le sol.',
            'Décoller légèrement les bras et le haut de la poitrine, le regard vers le sol, la nuque dans le prolongement du dos.',
        ],
        steps: [
            'Faire passer les bras sur les côtés, en arc, jusqu’au-dessus de la tête, en tournant les pouces vers le plafond.',
            'Revenir par le même arc jusqu’aux hanches.',
            'Enchaîner lentement sans reposer les bras.',
        ],
        cues: [
            'Garder les bras tendus et décollés du sol.',
            'Garder les épaules basses, loin des oreilles.',
            'Bouger lentement, à vitesse régulière.',
        ],
        mistakes: [
            'Lever la tête et cambrer fort.',
            'Reposer les bras à chaque passage.',
            'Forcer l’arc quand l’épaule bloque.',
        ],
        breathing: 'Respirer calmement, sans bloquer.',
    },
    'wall-isometric-external-rotation': {
        name: 'Rotation externe isométrique contre le mur',
        aliases: ['Rotation externe isométrique', 'Rotation externe contre un encadrement de porte', 'Isometric external rotation'],
        summary: 'Pousser le dos du poignet contre un mur, coude au corps, sans bouger : un travail doux de la coiffe des rotateurs, possible quand l’épaule est encore sensible.',
        setup: [
            'Se tenir debout de profil, tout près d’un mur ou d’un encadrement de porte, le côté travaillé vers lui.',
            'Plier le coude à angle droit, collé contre le flanc, une serviette roulée entre le coude et les côtes.',
            'Poser le dos du poignet contre le mur, l’avant-bras pointé vers l’avant.',
        ],
        steps: [
            'Pousser le dos du poignet contre le mur, comme pour ouvrir l’avant-bras vers l’extérieur, sans bouger.',
            'Tenir la poussée à intensité modérée pendant toute la durée.',
            'Relâcher doucement, puis changer de côté.',
        ],
        cues: [
            'Garder le coude collé au corps.',
            'Pousser à intensité modérée, jamais jusqu’à la douleur.',
            'Garder l’épaule basse et le buste face à l’avant.',
        ],
        mistakes: [
            'Tourner le buste pour pousser plus fort.',
            'Décoller le coude du flanc.',
            'Pousser par à-coups.',
        ],
        breathing: 'Respirer calmement, sans bloquer.',
        safety: 'Rester sous le seuil de la douleur ; si la gêne augmente pendant la tenue, pousser moins fort.',
    },
    'band-external-rotation': {
        name: 'Rotations externes à l’élastique',
        aliases: ['Rotations externes des épaules', 'Band external rotation'],
        summary: 'Coudes au corps, écarter les avant-bras contre un élastique : un travail doux de la coiffe des rotateurs.',
        setup: [
            'Se tenir debout, l’élastique tendu entre les deux mains, ou une mini-bande autour des poignets, paumes vers le haut.',
            'Coller les coudes contre les côtes, pliés à angle droit, avant-bras vers l’avant.',
        ],
        steps: [
            'Écarter les mains vers l’extérieur en gardant les coudes collés au corps.',
            'Tenir une seconde, avant-bras ouverts.',
            'Revenir lentement.',
        ],
        cues: [
            'Garder les coudes contre les côtes, comme pour tenir une serviette.',
            'Garder les poignets droits.',
            'Ouvrir aussi loin que possible sans que le buste tourne ni se cambre.',
        ],
        mistakes: [
            'Décoller les coudes du corps.',
            'Pencher le buste en arrière.',
            'Choisir un élastique trop dur.',
        ],
        breathing: 'Souffler en ouvrant, inspirer en revenant.',
    },
    'side-lying-dumbbell-external-rotation': {
        name: 'Rotations externes sur le côté à l’haltère',
        aliases: ['Rotation externe couchée', 'Side-lying external rotation'],
        summary: 'Allongé sur le côté, faire pivoter l’avant-bras vers le haut avec un haltère léger : la coiffe des rotateurs, sans tricher.',
        setup: [
            'S’allonger sur le côté, la tête posée sur le bras du dessous ou sur un coussin.',
            'Plier le coude du dessus à angle droit, collé contre le flanc, une serviette roulée entre le coude et les côtes.',
            'Tenir un haltère léger, l’avant-bras devant le ventre.',
        ],
        steps: [
            'Faire pivoter l’avant-bras vers le plafond en gardant le coude contre le corps.',
            'S’arrêter quand l’avant-bras approche de la verticale, sans tourner le buste.',
            'Redescendre lentement devant le ventre.',
            'Faire toutes les répétitions, puis changer de côté.',
        ],
        cues: [
            'Garder le coude collé : il sert de charnière.',
            'Bouger lentement, en contrôlant la descente.',
            'Choisir une charge légère : la coiffe est faite de petits muscles.',
        ],
        mistakes: [
            'Décoller le coude du corps.',
            'Rouler le buste en arrière pour monter plus haut.',
            'Prendre trop lourd.',
        ],
        breathing: 'Souffler en montant, inspirer en redescendant.',
    },
    'cuban-press': {
        name: 'Développé cubain',
        aliases: ['Cuban press', 'Développé cubain aux haltères'],
        summary: 'Un enchaînement en trois temps, tirage, rotation puis développé, avec des haltères légers : la coiffe des rotateurs et le milieu de l’épaule.',
        setup: [
            'Se tenir debout, pieds à la largeur des hanches, un haltère léger dans chaque main devant les cuisses.',
        ],
        steps: [
            'Monter les coudes sur les côtés jusqu’à hauteur d’épaules, avant-bras pendants.',
            'Faire pivoter les avant-bras vers le haut, coudes fixes, jusqu’à ce que les mains soient au-dessus des coudes.',
            'Pousser les haltères au-dessus de la tête jusqu’aux bras tendus.',
            'Redescendre en refaisant les trois temps à l’envers.',
        ],
        cues: [
            'Garder les coudes à hauteur d’épaules pendant la rotation.',
            'Choisir des haltères très légers.',
            'Marquer chaque temps, sans se presser.',
        ],
        mistakes: [
            'Monter les coudes plus haut que les épaules au tirage.',
            'Laisser les coudes descendre pendant la rotation.',
            'Prendre trop lourd.',
        ],
        breathing: 'Souffler pendant la rotation et la poussée, inspirer en redescendant.',
        safety: 'Arrêter en cas de pincement ou de douleur à l’avant de l’épaule pendant le tirage ou la rotation.',
    },

    // Haussements d’épaules
    'dumbbell-shrug': {
        name: 'Haussements d’épaules aux haltères',
        aliases: ['Shrugs aux haltères', 'Shrugs', 'Dumbbell shrug'],
        summary: 'Monter les épaules vers les oreilles avec un haltère dans chaque main : le haut des trapèzes, et la poigne au passage.',
        setup: [
            'Se tenir debout, pieds à la largeur des hanches, un haltère dans chaque main.',
            'Laisser pendre les bras le long du corps, paumes face aux cuisses.',
        ],
        steps: [
            'Monter les épaules tout droit vers les oreilles, bras tendus.',
            'Tenir une seconde en haut.',
            'Redescendre lentement, jusqu’à sentir le haut des épaules s’étirer.',
        ],
        cues: [
            'Monter à la verticale, sans faire rouler les épaules.',
            'Garder les bras tendus : les mains ne font que tenir.',
            'Garder la nuque longue, le menton neutre.',
        ],
        mistakes: [
            'Faire rouler les épaules d’avant en arrière.',
            'Plier les coudes pour tirer.',
            'Avancer la tête.',
        ],
        breathing: 'Souffler en montant, inspirer en redescendant.',
    },
    'barbell-shrug': {
        name: 'Haussements d’épaules à la barre',
        aliases: ['Shrugs à la barre', 'Barbell shrug'],
        summary: 'Les haussements d’épaules avec une barre chargée : le haut des trapèzes sous une charge lourde, et une poigne solide.',
        setup: [
            'Prendre la barre paumes vers soi, mains un peu plus écartées que les hanches.',
            'La sortir d’un rack réglé à mi-cuisses, ou la soulever du sol dos plat, comme pour un soulevé de terre.',
            'Se tenir debout, bras tendus, la barre contre les cuisses.',
        ],
        steps: [
            'Monter les épaules tout droit vers les oreilles, bras tendus.',
            'Tenir une seconde en haut.',
            'Redescendre lentement jusqu’en bas.',
        ],
        cues: [
            'Rester droit, le ventre gainé, sans se pencher en arrière.',
            'Garder les bras tendus : les mains ne font que tenir.',
            'Garder la barre au contact des cuisses.',
        ],
        mistakes: [
            'Donner un élan avec les jambes.',
            'Faire rouler les épaules.',
            'Arrondir le dos.',
        ],
        breathing: 'Souffler en montant, inspirer en redescendant.',
        safety: 'Reposer la barre en fin de série, sur le rack ou au sol en pliant hanches et genoux dos plat, plutôt que de la lâcher.',
    },
};
