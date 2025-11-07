import Kumo3 from '../assets/Kumo_3.jpg'
import KiiroVideo from '../assets/Kiiro_Run.mp4'
import MaguroVid from '../assets/Maguro.mp4'
import LucasVid from '../assets/Lucas.mp4'
import HalVideo from '../assets/HalVid.mp4'
import YumiVideo from '../assets/Yumi_Run.mp4'

const characters = [
    {
        name: 'Kumo',
        baseImages: [Kumo3],
        confirmedImages: [Kumo3],
        animation: [], // Thresholds for Kumo's progression
    },
    {
        name: 'Kiiro',
        baseImages: [ ],
        confirmedImages: [ ],
        animation: [KiiroVideo], 
    },
    {
        name: 'Maguro',
        baseImages: [ ],
        confirmedImages: [ ],
        animation: [MaguroVid], // Thresholds for Maguro's progression
    },
    {
        name: 'Lucas',
        baseImages: [ ],
        confirmedImages: [ ],
        animation: [LucasVid], // Thresholds for Lucas's progression
    },
    {
        name: 'Hal',
        baseImages: [ ],
        confirmedImages: [ ],
        animation: [HalVideo], // Thresholds for Jack's progression
    },
    {
        name: 'Yumi',
        baseImages: [ ],
        confirmedImages: [ ],
        animation: [YumiVideo], // Thresholds for Jack's progression
    },
];

export default characters;