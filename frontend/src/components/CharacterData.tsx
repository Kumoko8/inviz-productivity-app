
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
        defaultAnimation: [],
        animation: 'characters/kumo_1.mp4', // Thresholds for Kumo's progression
    },
    {
        id: "kiiro_1",
        name: 'Kiiro',
        defaultAnimation: [],
        animation: '', 
    },
    {
        id: "maguro_1",
        name: 'Maguro',
        defaultAnimation: [],
        animation: [], // Thresholds for Maguro's progression
    },
    {
        id: "lucas_1",
        name: 'Lucas',
        defaultAnimation: [],
        animation: [], // Thresholds for Lucas's progression
    },
    {
        id: "hal_1",
        name: 'Hal',
        defaultAnimation: [],
        animation: [], // Thresholds for Jack's progression
    },
    {
        id: "yumi_1",
        name: 'Yumi',
        defaultAnimation: [],
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