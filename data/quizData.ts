
export interface Question {
    question: string;
    options: string[];
    correctAnswer: number;
}

export const STATIC_QUIZZES: Record<string, Question[]> = {
    'Neuroradiology': [
        {
            question: "Which of the following is the most sensitive sequence for detecting acute cytotoxic edema in ischemic stroke?",
            options: ["T1-weighted", "T2-weighted", "Diffusion-Weighted Imaging (DWI)", "FLAIR"],
            correctAnswer: 2
        },
        {
            question: "What is the characteristic appearance of a glioblastoma multiforme on MRI?",
            options: ["Homogeneous enhancement", "Ring enhancement with central necrosis", "Non-enhancing mass", "Calcified mass"],
            correctAnswer: 1
        },
        {
            question: "A 'dense MCA sign' on CT suggests:",
            options: ["Subarachnoid hemorrhage", "Acute thrombus in the Middle Cerebral Artery", "Meningioma", "Multiple Sclerosis plaque"],
            correctAnswer: 1
        }
    ],
    'Gastrointestinal': [
        {
            question: "The 'coffee bean sign' on an abdominal X-ray is classic for which condition?",
            options: ["Cecal volvulus", "Sigmoid volvulus", "Small bowel obstruction", "Appendicitis"],
            correctAnswer: 1
        },
        {
            question: "Which imaging modality is the gold standard for diagnosing cholecystitis?",
            options: ["Abdominal X-ray", "HIDA Scan", "CT Abdomen", "Ultrasound (though HIDA is more specific)"],
            correctAnswer: 1
        },
        {
            question: "Thickened bowel wall with 'thumbprinting' on X-ray indicates:",
            options: ["Ischemic colitis", "Crohn's disease", "Ulcerative colitis", "Diverticulitis"],
            correctAnswer: 0
        }
    ],
    'Cardiology': [
        {
            question: "Kerley B lines on a chest X-ray are indicative of:",
            options: ["Pneumonia", "Pneumothorax", "Pulmonary edema / CHF", "Pulmonary fibrosis"],
            correctAnswer: 2
        },
        {
            question: "On a CT Angiogram, an intimal flap in the aorta is diagnostic of:",
            options: ["Aortic Aneurysm", "Aortic Dissection", "Coarctation of the Aorta", "Aortic Stenosis"],
            correctAnswer: 1
        },
        {
            question: "Which view is best for assessing the left atrium on TTE?",
            options: ["Parasternal long axis", "Apical 4-chamber", "Subcostal", "Suprasternal"],
            correctAnswer: 1
        }
    ],
    'Orthopedics': [
        {
            question: "A 'scotty dog' sign on an oblique lumbar spine X-ray with a collar indicates:",
            options: ["Spondylolisthesis", "Spondylolysis", "Disc herniation", "Vertebral fracture"],
            correctAnswer: 1
        },
        {
            question: "The 'sail sign' on an elbow X-ray suggests:",
            options: ["Distal radius fracture", "Radial head fracture / Joint effusion", "Olecranon fracture", "Supracondylar fracture"],
            correctAnswer: 1
        },
        {
            question: "Which Salter-Harris fracture involves the physis and the epiphysis?",
            options: ["Type I", "Type II", "Type III", "Type IV"],
            correctAnswer: 2
        }
    ],
    'Pulmonology': [
        {
            question: "A 'deep sulcus sign' on a supine chest X-ray indicates:",
            options: ["Pleural effusion", "Pneumothorax", "Pneumonia", "Atelectasis"],
            correctAnswer: 1
        },
        {
            question: "Which CT finding is hallmark for Idiopathic Pulmonary Fibrosis (IPF)?",
            options: ["Tree-in-bud", "Honeycombing in a subpleural distribution", "Ground-glass opacities", "Mosaic attenuation"],
            correctAnswer: 1
        },
        {
            question: "The 'silhouette sign' helps localize:",
            options: ["Pneumothorax", "Airspace opacities relative to heart/diaphragm borders", "Pleural effusion", "Lung nodules"],
            correctAnswer: 1
        }
    ],
    'Emergency Medicine': [
        {
            question: "FAST exam is primarily used to detect:",
            options: ["Solid organ injury", "Free fluid (blood) in peritoneum/pericardium", "Pneumothorax", "Bone fractures"],
            correctAnswer: 1
        },
        {
            question: "Free air under the diaphragm on an upright CXR indicates:",
            options: ["Pneumothorax", "Pneumomediastinum", "Pneumoperitoneum (Perforated viscus)", "Subcutaneous emphysema"],
            correctAnswer: 2
        },
        {
            question: "A 'tripod fracture' involves which bones?",
            options: ["Mandible", "Zygomatic arch, orbital floor, and lateral orbital rim", "Nasal bones", "Frontal sinus"],
            correctAnswer: 1
        }
    ],
    'Oncology': [
        {
            question: "'Cannonball metastases' in the lungs are classically associated with:",
            options: ["Breast cancer", "Renal Cell Carcinoma", "Prostate cancer", "Thyroid cancer"],
            correctAnswer: 1
        },
        {
            question: "On PET-CT, increased FDG uptake usually indicates:",
            options: ["Necrosis", "High metabolic activity (Malignancy or Infection)", "Cystic fluid", "Calcification"],
            correctAnswer: 1
        },
        {
            question: "Sunburst periosteal reaction is characteristic of:",
            options: ["Osteosarcoma", "Ewing's Sarcoma", "Osteoid Osteoma", "Chondrosarcoma"],
            correctAnswer: 0
        }
    ]
};
