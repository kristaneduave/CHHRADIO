export type ScheduleItem = {
    doctor: string;
    time: string;
    subtext?: string;
};

export type DaySchedule = {
    [key: string]: ScheduleItem[]; // e.g., 'Monday': [...]
};

export type ModalitySchedule = {
    id: string;
    name: string;
    schedule: DaySchedule;
};

export type HospitalSchedule = {
    id: string;
    name: string;
    modalities: ModalitySchedule[];
};

export const CONSULTANT_SCHEDULE: HospitalSchedule[] = [
    {
        id: 'fuente',
        name: 'Fuente',
        modalities: [
            {
                id: 'gen_rad',
                name: 'General Radiology',
                schedule: {
                    Monday: [
                        { doctor: 'Dr. Ding', time: '7:01 AM - 4:00 PM' },
                        { doctor: 'Dr. Balili', time: '4:01 PM - 8:00 PM' },
                        { doctor: 'Dr. Ding', time: '8:01 PM - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Tuesday: [
                        { doctor: 'Dr. Ding', time: '7:01 AM - 4:00 PM' },
                        { doctor: 'Dr. Balili', time: '4:01 PM - 8:00 PM' },
                        { doctor: 'Dr. Ding', time: '8:01 PM - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Wednesday: [
                        { doctor: 'Dr. Ding', time: '7:01 AM - 4:00 PM' },
                        { doctor: 'Dr. Balili', time: '4:01 PM - 8:00 PM' },
                        { doctor: 'Dr. Ding', time: '8:01 PM - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Thursday: [
                        { doctor: 'Dr. Ding', time: '7:01 AM - 4:00 PM' },
                        { doctor: 'Dr. Balili', time: '4:01 PM - 8:00 PM' },
                        { doctor: 'Dr. Ding', time: '8:01 PM - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Ding', time: '7:01 AM - 1:00 PM' },
                        { doctor: 'Dr. Sucaldito', time: '1:01 PM - 4:00 PM' },
                        { doctor: 'Dr. Balili', time: '4:01 PM - 8:00 PM' },
                        { doctor: 'Dr. Sucaldito', time: '8:01 PM - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Sucaldito', time: '7:01 AM - 1:00 PM' },
                        { doctor: 'Dr. Acuña/Huntrix', time: '1:01 PM - 7:00 AM' },
                    ],
                    Sunday: [
                        { doctor: 'Dr. Acuña/Huntrix', time: '7:01 AM - 1:00 PM' },
                        { doctor: 'Dr. Ding', time: '1:01 PM - 7:00 AM', subtext: '(Next Day)' },
                    ],
                },
            },
            {
                id: 'mri',
                name: 'MRI',
                schedule: {
                    Monday: [
                        { doctor: 'Dr. Fernandez/Dr. Yu', time: '7:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Tuesday: [
                        { doctor: 'Dr. Fernandez/Dr. Yu', time: '7:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Wednesday: [
                        { doctor: 'Dr. Fernandez/Dr. Yu', time: '7:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Thursday: [
                        { doctor: 'Dr. Fernandez/Dr. Yu', time: '7:01 AM - 12:00 AM' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Koa', time: '12:01 AM - 12:00 NN' },
                        { doctor: 'Dr. Gimeno', time: '12:01 NN - 12:00 AM', subtext: '(Next Day)' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Reynes', time: '12:01 AM - 12:00 NN' },
                        { doctor: 'Dr. Alvarez', time: '12:01 NN - 12:00 AM' },
                    ],
                    Sunday: [
                        { doctor: 'Dr. Fernandez/Dr. Yu', time: '12:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                },
            },
            {
                id: 'ct',
                name: 'CT',
                schedule: {
                    Monday: [
                        { doctor: 'Dr. Chan', time: '7:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Tuesday: [
                        { doctor: 'Dr. Chan', time: '7:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Wednesday: [
                        { doctor: 'Dr. Chan', time: '7:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Thursday: [
                        { doctor: 'Dr. Chan', time: '7:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Yu', time: '7:01 - 5:00 PM', subtext: '(Next Day)' },
                        { doctor: 'Dr. Alvarez', time: '5:00 PM - 7:00 AM' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Chan', time: '7:01 - 7:00 AM' },
                    ],
                    Sunday: [
                        { doctor: 'Dr. Chan', time: '7:01 - 7:00 AM', subtext: '(Next Day)' },
                    ],
                },
            },
            {
                id: 'gen_us',
                name: 'General Ultrasound',
                schedule: {
                    Monday: [
                        { doctor: 'Dr. Tornilla', time: '6:00 AM - 5:00 PM' },
                        { doctor: 'Dr. Padillo', time: '6:00 AM - 12:00 NN' },
                        { doctor: 'Dr. Paredes', time: '12:00 PM - 5:00 PM' },
                    ],
                    Tuesday: [
                        { doctor: 'Dr. Tarongoy', time: '6:00 AM - 5:00 PM' },
                        { doctor: 'Dr. Abrigonda', time: '6:00 AM - 11:00 AM' },
                        { doctor: 'Dr. Padillo', time: '11:00 AM - 2:00 PM' },
                    ],
                    Wednesday: [
                        { doctor: 'Dr. Tornilla', time: '6:00 AM - 5:00 PM' },
                        { doctor: 'Dr. Padillo', time: '6:00 AM - 12:00 NN' },
                        { doctor: 'Dr. Paredes', time: '12:00 PM - 2:00 PM' },
                    ],
                    Thursday: [
                        { doctor: 'Dr. Tarongoy', time: '6:00 AM - 5:00 PM' },
                        { doctor: 'Dr. Abrigonda', time: '6:00 AM - 11:00 AM' },
                        { doctor: 'Dr. Padillo', time: '11:00 AM - 2:00 PM' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Tornilla', time: '6:00 AM - 2:00 PM' },
                        { doctor: 'Dr. Padillo', time: '6:00 AM - 12:00 NN' },
                        { doctor: 'Dr. Paredes', time: '12:00 PM - 5:00 PM' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Tarongoy', time: '6:00 AM - 12:00 PM' },
                        { doctor: 'Dr. Abrigonda/Paredes', time: '6:00 AM - 11:00 AM' },
                    ],
                    Sunday: [],
                },
            },
            {
                id: 'mammo',
                name: 'Breast / Mammo',
                schedule: {
                    Monday: [{ doctor: 'Dr. Avila', time: 'AM-PM' }],
                    Tuesday: [{ doctor: 'Dr. Avila', time: 'AM-PM' }],
                    Wednesday: [{ doctor: 'Dr. Jorge', time: 'AM-PM' }],
                    Thursday: [
                        { doctor: 'Dr. Avila', time: 'AM' },
                        { doctor: 'Dr. Guinto', time: 'AM-PM' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Avila', time: 'AM' },
                        { doctor: 'Dr. Guinto', time: 'AM-PM' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Ledesma', time: 'AM' },
                        { doctor: 'Dr. Guinto', time: 'PM' },
                    ],
                    Sunday: [],
                }
            }
        ],
    },

    {
        id: 'mandaue',
        name: 'Mandaue',
        modalities: [
            {
                id: 'gen_ultrasound',
                name: 'General Ultrasound',
                schedule: {
                    Monday: [
                        { doctor: 'Dr. Gimeno', time: '6:00 - 10:00 AM' },
                        { doctor: 'Dr. Jorge', time: '1:00 PM - 5:00 PM' },
                    ],
                    Tuesday: [
                        { doctor: 'Dr. Gimeno', time: '6:00 - 10:00 AM' },
                        { doctor: 'Dr. Paredes', time: '1:00 PM - 5:00 PM' },
                    ],
                    Wednesday: [
                        { doctor: 'Dr. Gimeno', time: '6:00 - 10:00 AM' },
                        { doctor: 'Dr. Guinto', time: '1:00 PM - 5:00 PM' },
                    ],
                    Thursday: [
                        { doctor: 'Dr. Gimeno', time: '6:00 - 7:30 AM' },
                        { doctor: 'Dr. Guinto', time: '7:30 - 10:00 AM' },
                        { doctor: 'Dr. Paredes', time: '1:00 PM - 5:00 PM' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Gimeno', time: '6:00 - 7:30 AM' },
                        { doctor: 'Dr. Guinto', time: '7:30 - 10:00 AM' },
                        { doctor: 'Dr. Cadiz', time: '1:00 - 5:00 PM' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Guinto', time: '6:00 - 12:00 NN' },
                        { doctor: 'Dr. Ledesma', time: '1:00 PM - 5:00 PM' },
                    ],
                    Sunday: [],
                },
            },
            {
                id: 'breast_mammo',
                name: 'Breast / Mammo',
                schedule: {
                    Monday: [
                        { doctor: 'Dr. Jorge', time: '8:00 AM - 5:00 PM' },
                    ],
                    Tuesday: [
                        { doctor: 'Dr. Jorge', time: '8:00 AM - 2:00 PM' },
                    ],
                    Wednesday: [
                        { doctor: 'Dr. Guinto', time: '8:00 AM - 5:00 PM' },
                    ],
                    Thursday: [
                        { doctor: 'Dr. Jorge', time: '8:00 AM - 2:00 PM' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Jorge', time: '8:00 AM - 1:30 PM' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Guinto', time: '8:00 AM - 12:00 AM' },
                    ],
                    Sunday: [],
                },
            },
        ],
    },
    {
        id: 'medical_mall',
        name: 'Medical Mall',
        modalities: [
            {
                id: 'gen_ultrasound',
                name: 'General Ultrasound',
                schedule: {
                    Monday: [
                        { doctor: 'Dr. Ledesma', time: '6:00 AM - 12:00 NN' },
                        { doctor: 'Dr. Gimeno', time: '1:00 PM - 5:00 PM' },
                    ],
                    Tuesday: [
                        { doctor: 'Dr. Tornilla', time: '6:00 AM - 5:00 PM' },
                    ],
                    Wednesday: [
                        { doctor: 'Dr. Tarongoy', time: '6:00 AM - 5:00 PM' },
                    ],
                    Thursday: [
                        { doctor: 'Dr. Tornilla', time: '6:00 AM - 5:00 PM' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Tarongoy', time: '6:00 AM - 5:00 PM' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Gimeno', time: '6:00 AM - 12:00 NN' },
                        { doctor: 'Dr. Ledesma', time: '1:00 PM - 5:00 PM' },
                    ],
                    Sunday: [],
                },
            },
            {
                id: 'breast_mammo',
                name: 'Breast / Mammo',
                schedule: {
                    Monday: [
                        { doctor: 'Dr. Ledesma', time: '6:00 AM - 12:00 PM' },
                    ],
                    Tuesday: [
                        { doctor: 'Dr. Ledesma', time: '10:00 AM - 5:00 PM' },
                    ],
                    Wednesday: [
                        { doctor: 'Dr. Ledesma', time: '10:00 AM - 5:00 PM' },
                    ],
                    Thursday: [
                        { doctor: 'Dr. Ledesma', time: '10:00 AM - 5:00 PM' },
                    ],
                    Friday: [
                        { doctor: 'Dr. Ledesma', time: '10:00 AM - 5:00 PM' },
                    ],
                    Saturday: [
                        { doctor: 'Dr. Ledesma', time: '1:00 PM - 5:00 PM' },
                    ],
                    Sunday: [],
                },
            },
        ],
    },
];
