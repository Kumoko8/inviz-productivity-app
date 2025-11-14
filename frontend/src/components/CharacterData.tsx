import KumoVideo from '../assets/Kumo.mp4'
import KiiroVideo from '../assets/Kiiro.mp4'
import MaguroVid from '../assets/Maguro.mp4'
import LucasVid from '../assets/Lucas.mp4'
import HalVideo from '../assets/Hal.mp4'
import YumiVideo from '../assets/Yumi.mp4'

export interface Character {
    id: string;
    name: string;
    defaultAnimation?: string;
    animation?: string;

}

const characters = [
    {
        id: "kumo_1",
        name: 'Kumo',
        defaultAnimation: [KumoVideo],
        animation: 'characters/kumo_1.mp4', // Thresholds for Kumo's progression
    },
    {
        id: "kiiro_1",
        name: 'Kiiro',
        defaultAnimation: [KiiroVideo],
        animation: '', 
    },
    {
        id: "maguro_1",
        name: 'Maguro',
        defaultAnimation: [MaguroVid],
        animation: [], // Thresholds for Maguro's progression
    },
    {
        id: "lucas_1",
        name: 'Lucas',
        defaultAnimation: [LucasVid],
        animation: [], // Thresholds for Lucas's progression
    },
    {
        id: "hal_1",
        name: 'Hal',
        defaultAnimation: [HalVideo],
        animation: [], // Thresholds for Jack's progression
    },
    {
        id: "yumi_1",
        name: 'Yumi',
        defaultAnimation: [YumiVideo],
        animation: [], // Thresholds for Jack's progression
    },
    {
        id: "mushi_1",
        name: 'Mushi',
        defaultAnimation: [ ],
        animation: [], // Thresholds for Mushi's progression
    },
];

export default characters;