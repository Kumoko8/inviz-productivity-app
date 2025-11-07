import Kumo3 from '../assets/Kumo_3.jpg'
import Kiiro4 from '../assets/Kiiro_4.jpg'
import Jack4 from '../assets/Jack_4.jpg'
import Maguro5 from '../assets/Maguro_5.jpg'
import Lucas4 from '../assets/Lucas_4.jpg'
import HalVideo from '../assets/HalVid.mp4'

const characters = [
    {
        name: 'Kumo',
        baseImages: [Kumo3],
        confirmedImages: [Kumo3],
        animation: [], // Thresholds for Kumo's progression
    },
    {
        name: 'Kiiro',
        baseImages: [Kiiro4],
        confirmedImages: [Kiiro4],
        animation: [2, 5, 10, 20, 40], 
    },
    {
        name: 'Maguro',
        baseImages: [Maguro5],
        confirmedImages: [Maguro5],
        animation: [2, 4, 8, 15, 30], // Thresholds for Maguro's progression
    },
    {
        name: 'Lucas',
        baseImages: [Lucas4],
        confirmedImages: [ ],
        animation: [2, 4, 8, 15, 30], // Thresholds for Lucas's progression
    },
    {
        name: 'Hal',
        baseImages: [ ],
        confirmedImages: [ ],
        animation: [HalVideo], // Thresholds for Jack's progression
    },
];

export default characters;