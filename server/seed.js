import { writeStore, randomId } from './store.js';

const professorUser = {
  id: 'prof1',
  email: 'schen@andrew.cmu.edu',
  name: 'Dr. Sarah Chen',
  role: 'professor',
  createdAt: new Date().toISOString(),
};

const studentUser = {
  id: 'stud1',
  email: 'student1@andrew.cmu.edu',
  name: 'Avery Student',
  role: 'student',
  createdAt: new Date().toISOString(),
};

const store = {
  users: [professorUser, studentUser],
  postings: [],
  studentProfiles: [
    {
      id: randomId('sp'),
      userId: studentUser.id,
      name: studentUser.name,
      major: 'Computer Science',
      graduationYear: '2027',
      skills: ['React', 'Python', 'Machine Learning'],
      interests: ['AI', 'HCI'],
      resume: {
        name: 'avery_resume.pdf',
        uploadDate: new Date().toISOString(),
      },
    },
  ],
  professorProfiles: [
    {
      id: randomId('pp'),
      userId: professorUser.id,
      department: 'Computer Science',
      title: 'Associate Professor',
      contactEmail: professorUser.email,
      officeHours: 'Tue 2-4 PM, Gates 8102',
      bioUrl: '',
      researchAreas: '',
      professorWebsite: '',
      publicationsLink: '',
      researchInterests: '',
      photoBase64: '',
    },
  ],
};

writeStore(store);
console.log('Seed complete: server/data/store.json');
