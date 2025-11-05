import Kumo3 from '../assets/Kumo_3.jpg'
import Kumo1 from '../assets/Kumo_1.jpg'
import Kumo2 from '../assets/Kumo_2.jpg'
import Kumo4 from '../assets/Kumo_4.jpg'
import Kumo5 from '../assets/Kumo_5.jpg'
import Kumo6 from '../assets/Kumo_6.jpg'
import Kiiro4 from '../assets/Kiiro_4.jpg'
import Kiiro1 from '../assets/Kiiro_1.jpg'
import Kiiro2 from '../assets/Kiiro_2.jpg'
import Kiiro3 from '../assets/Kiiro_2.jpg'
import Kiiro5 from '../assets/Kiiro_5.jpg'
import Kiiro6 from '../assets/Kiiro_6.jpg'
import Maguro4 from '../assets/Maguro_4.jpg'
import Maguro1 from '../assets/Maguro_1.jpg'
import Maguro2 from '../assets/Maguro_2.jpg'
import Maguro3 from '../assets/Maguro_3.jpg'
import Maguro5 from '../assets/Maguro_5.jpg'
import Maguro6 from '../assets/Maguro_6.jpg'
import Lucas4 from '../assets/Lucas_4.jpg'

const characters = [
    {
        name: 'Kumo',
        baseImages: [Kumo3],
        confirmedImages: [Kumo1, Kumo2, Kumo3, Kumo4, Kumo5, Kumo6],
        thresholds: [5, 8, 12, 20, 35], // Thresholds for Kumo's progression
    },
    {
        name: 'Kiiro',
        baseImages: [Kiiro4],
        confirmedImages: [Kiiro1, Kiiro2, Kiiro3, Kiiro4, Kiiro5, Kiiro6],
        thresholds: [2, 5, 10, 20, 40], 
    },
    {
        name: 'Maguro',
        baseImages: [Maguro4],
        confirmedImages: [Maguro1, Maguro2, Maguro3, Maguro4, Maguro5, Maguro6],
        thresholds: [2, 4, 8, 15, 30], // Thresholds for Maguro's progression
    },
    {
        name: 'Lucas',
        baseImages: [Lucas4],
        confirmedImages: [ ],
        thresholds: [2, 4, 8, 15, 30], // Thresholds for Lucas's progression
    },
];

export default characters;