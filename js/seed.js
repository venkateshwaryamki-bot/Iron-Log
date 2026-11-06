// Built-in exercise library and starter plan, written to the database on first run.
window.IL = window.IL || {};

IL.CATEGORIES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Cardio', 'Full Body', 'Mobility'];

IL.uid = function () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};

IL.LIBRARY = {
  Chest: {
    'Bench Press': ['Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Incline Barbell Press', 'Machine Chest Press'],
    'Cable Fly': ['High-to-Low Cable Fly', 'Low-to-High Cable Fly', 'Standing Cable Fly'],
    'Pec Deck': ['Machine'],
    'Push-Up': ['Standard', 'Incline', 'Decline'],
    'Chest Dip': ['Bodyweight', 'Weighted'],
  },
  Back: {
    'Lat Pulldown': ['Wide Grip', 'Close Grip', 'Reverse Grip'],
    'Seated Cable Row': ['Close Grip Row', 'Wide Grip Row'],
    'Barbell Row': ['Overhand', 'Underhand'],
    'Pull-Up': ['Standard', 'Chin-Up', 'Assisted'],
    'Deadlift': ['Conventional', 'Sumo'],
    'Single-Arm Dumbbell Row': ['Bench Supported'],
  },
  Shoulders: {
    'Overhead Press': ['Barbell Standing', 'Dumbbell Seated', 'Machine'],
    'Lateral Raise': ['Dumbbell', 'Cable'],
    'Rear Delt Fly': ['Dumbbell', 'Reverse Pec Deck'],
    'Face Pull': ['Rope'],
    'Shrug': ['Dumbbell', 'Barbell'],
  },
  Biceps: {
    'Bicep Curl': ['Barbell', 'Dumbbell', 'EZ-Bar', 'Cable'],
    'Hammer Curl': ['Dumbbell', 'Rope Cable'],
    'Preacher Curl': ['EZ-Bar', 'Machine'],
    'Incline Curl': ['Dumbbell'],
  },
  Triceps: {
    'Triceps Pushdown': ['Rope', 'Straight Bar', 'V-Bar'],
    'Overhead Triceps Extension': ['Dumbbell', 'Cable'],
    'Skull Crusher': ['EZ-Bar', 'Dumbbell'],
    'Close-Grip Bench Press': ['Barbell'],
  },
  Legs: {
    'Squat': ['Back Squat', 'Front Squat', 'Goblet Squat', 'Smith Machine Squat'],
    'Leg Press': ['Standard', 'Narrow Stance'],
    'Romanian Deadlift': ['Barbell', 'Dumbbell'],
    'Lunge': ['Walking Lunge', 'Bulgarian Split Squat', 'Reverse Lunge'],
    'Leg Extension': ['Machine'],
    'Leg Curl': ['Lying', 'Seated'],
    'Calf Raise': ['Standing', 'Seated'],
    'Hip Thrust': ['Barbell', 'Machine'],
  },
  Abs: {
    'Crunch': ['Floor', 'Cable', 'Machine'],
    'Hanging Leg Raise': ['Straight Leg', 'Knee Raise'],
    'Plank': ['Front Plank', 'Side Plank'],
    'Russian Twist': ['Weighted'],
    'Ab Wheel': ['Kneeling'],
  },
  Cardio: {
    'Treadmill': ['Run', 'Incline Walk'],
    'Stationary Bike': ['Steady State', 'Intervals'],
    'Rowing Machine': ['Steady State', 'Intervals'],
    'Stair Climber': ['Steady State'],
  },
  'Full Body': {
    'Kettlebell Swing': ['Two-Hand', 'Single-Arm'],
    'Clean': ['Power Clean', 'Hang Clean'],
    'Thruster': ['Barbell', 'Dumbbell'],
    'Burpee': ['Standard'],
  },
  Mobility: {
    'Hip Mobility': ['90/90 Switch', 'Couch Stretch'],
    'Thoracic Rotation': ['Open Book'],
    'Shoulder Dislocate': ['Band'],
  },
};

IL.buildSeed = function () {
  const now = Date.now();
  const exercises = [];
  const variations = [];
  const byName = {}; // "Exercise|Variation" -> variation id, used for the starter plan
  Object.entries(IL.LIBRARY).forEach(([category, exs]) => {
    Object.entries(exs).forEach(([name, vars]) => {
      const ex = { id: IL.uid(), name, category, custom: false, archived: false, createdAt: now };
      exercises.push(ex);
      vars.forEach((vname) => {
        const v = { id: IL.uid(), exerciseId: ex.id, name: vname, custom: false, archived: false, createdAt: now };
        variations.push(v);
        byName[name + '|' + vname] = v.id;
      });
    });
  });

  const item = (ex, v, sets = 3, reps = 10) => ({ id: IL.uid(), variationId: byName[ex + '|' + v], sets, reps });
  const day = (name, items) => ({ name, rest: false, items });
  const rest = () => ({ name: 'Rest', rest: true, items: [] });

  const plan = {
    id: IL.uid(),
    name: 'My Weekly Split',
    createdAt: now,
    days: [
      day('Chest & Triceps', [
        item('Bench Press', 'Barbell Bench Press', 4, 8),
        item('Bench Press', 'Incline Dumbbell Press', 3, 10),
        item('Cable Fly', 'High-to-Low Cable Fly', 3, 12),
        item('Triceps Pushdown', 'Rope', 3, 12),
        item('Overhead Triceps Extension', 'Cable', 3, 12),
      ]),
      rest(),
      day('Back & Biceps', [
        item('Lat Pulldown', 'Wide Grip', 4, 10),
        item('Seated Cable Row', 'Close Grip Row', 3, 10),
        item('Barbell Row', 'Overhand', 3, 8),
        item('Bicep Curl', 'EZ-Bar', 3, 10),
        item('Hammer Curl', 'Dumbbell', 3, 12),
      ]),
      day('Legs', [
        item('Squat', 'Back Squat', 4, 6),
        item('Romanian Deadlift', 'Barbell', 3, 8),
        item('Leg Press', 'Standard', 3, 12),
        item('Leg Curl', 'Seated', 3, 12),
        item('Calf Raise', 'Standing', 4, 15),
      ]),
      day('Shoulders & Abs', [
        item('Overhead Press', 'Dumbbell Seated', 4, 8),
        item('Lateral Raise', 'Dumbbell', 4, 15),
        item('Rear Delt Fly', 'Reverse Pec Deck', 3, 15),
        item('Hanging Leg Raise', 'Knee Raise', 3, 12),
        item('Crunch', 'Cable', 3, 15),
      ]),
      day('Cardio & Full Body', [
        item('Kettlebell Swing', 'Two-Hand', 3, 15),
        item('Thruster', 'Dumbbell', 3, 10),
        item('Rowing Machine', 'Intervals', 1, 1),
      ]),
      rest(),
    ],
  };

  return {
    exercises,
    variations,
    plans: [plan],
    sessions: [],
    meta: [{ id: 'settings', theme: 'dark', activePlanId: plan.id }],
  };
};
