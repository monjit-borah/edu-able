export const APP_DATA = {
  student: {
    name: "Aarav",
    grade: "Class 6",
    board: "CBSE",
    avatar: "https://ui-avatars.com/api/?name=Aarav&background=e7f2ff&color=2f5c8f&size=128&rounded=true"
  },
  subjects: [
    {
      id: "math",
      name: "Mathematics",
      color: "#5da8ff",
      chapters: [
        {
          id: "math-1",
          title: "Knowing Our Numbers",
          difficulty: "Easy",
          estimatedMinutes: 16,
          summary: [
            "Numbers can be written in expanded form to understand place value.",
            "We compare numbers by checking digits from left to right.",
            "Estimation helps us quickly judge approximate values."
          ],
          concepts: ["Place Value", "Comparing Numbers", "Estimation", "Number Line"],
          diagram: "A place-value chart showing ones, tens, hundreds, thousands and ten-thousands.",
          videoPlaceholder: "Short explanation video: Place value in daily life.",
          text: "Numbers are all around us. We use numbers to count people, objects and money. In class six, we learn how numbers become bigger and how their value depends on place. In 5,432 the digit 5 stands for five thousand. We can write numbers in expanded form. For example 5,432 equals 5,000 plus 400 plus 30 plus 2. We also compare numbers by looking at digits from left to right. Estimation helps us when exact answers are not needed. A number line is also helpful to visualize order and distance between numbers.",
          glossary: {
            expanded: { meaning: "Writing a number as the sum of place values.", pronunciation: "ik-span-did" },
            estimation: { meaning: "A close guess of a value.", pronunciation: "es-tuh-may-shun" },
            visualize: { meaning: "To form a mental picture.", pronunciation: "vizh-oo-uh-lize" }
          },
          quiz: [
            {
              id: "m1-q1",
              type: "mcq",
              question: "In 7,530, what is the place value of 5?",
              options: ["50", "500", "5", "5,000"],
              answerIndex: 1
            },
            {
              id: "m1-q2",
              type: "mcq",
              question: "Which number is greater?",
              options: ["45,678", "45,687", "45,607", "45,670"],
              answerIndex: 1
            },
            {
              id: "m1-match",
              type: "match",
              prompt: "Match the number with the correct expanded form",
              pairs: [
                { left: "3,204", right: "3,000 + 200 + 4" },
                { left: "9,010", right: "9,000 + 10" },
                { left: "6,540", right: "6,000 + 500 + 40" }
              ]
            }
          ]
        },
        {
          id: "math-2",
          title: "Fractions",
          difficulty: "Medium",
          estimatedMinutes: 18,
          summary: [
            "A fraction represents a part of a whole.",
            "Equivalent fractions have different forms but same value.",
            "Fractions can be compared using common denominators."
          ],
          concepts: ["Numerator", "Denominator", "Equivalent Fractions", "Like Fractions"],
          diagram: "A circle divided into equal slices showing 1/2, 1/3 and 1/4.",
          videoPlaceholder: "Short explanation video: Fraction pizza model.",
          text: "Fractions help us represent equal parts of a whole. In a fraction, the numerator tells how many parts are taken and the denominator tells total equal parts. Fractions like one half and two fourths can represent the same quantity. These are called equivalent fractions. To compare unlike fractions, we convert them into like fractions using a common denominator. Fractions are useful in cooking, measuring and sharing.",
          glossary: {
            numerator: { meaning: "Top number in a fraction.", pronunciation: "noo-muh-ray-tur" },
            denominator: { meaning: "Bottom number in a fraction.", pronunciation: "dee-nom-uh-nay-tur" },
            equivalent: { meaning: "Equal in value.", pronunciation: "ih-kwiv-uh-lent" }
          },
          quiz: [
            { id: "m2-q1", type: "mcq", question: "Which fraction is equal to 1/2?", options: ["2/3", "2/4", "3/5", "4/9"], answerIndex: 1 },
            { id: "m2-q2", type: "mcq", question: "In 3/8, denominator is:", options: ["3", "8", "11", "5"], answerIndex: 1 }
          ]
        }
      ]
    },
    {
      id: "science",
      name: "Science",
      color: "#52c79d",
      chapters: [
        {
          id: "science-1",
          title: "Food: Where Does It Come From?",
          difficulty: "Easy",
          estimatedMinutes: 14,
          summary: [
            "Food materials come from plants and animals.",
            "Different parts of plants can be eaten.",
            "Balanced meals contain different nutrients."
          ],
          concepts: ["Ingredients", "Sources of Food", "Plant Parts", "Balanced Diet"],
          diagram: "A farm-to-plate flow diagram connecting crop, market and kitchen.",
          videoPlaceholder: "Short explanation video: Farm to food chain.",
          text: "We eat different kinds of food every day. Some food items come from plants, and some come from animals. Rice, wheat and pulses are plant products. Milk and eggs come from animals. We may eat roots like carrot, stems like potato, leaves like spinach and fruits like mango. A healthy diet includes different nutrients such as carbohydrates, proteins, fats, vitamins and minerals.",
          glossary: {
            nutrients: { meaning: "Substances in food needed for growth and health.", pronunciation: "new-tree-ents" },
            carbohydrates: { meaning: "Nutrients that provide energy.", pronunciation: "kar-boh-hy-drates" },
            minerals: { meaning: "Essential elements needed by the body.", pronunciation: "min-er-uhlz" }
          },
          quiz: [
            { id: "s1-q1", type: "mcq", question: "Which is a plant source of food?", options: ["Milk", "Rice", "Egg", "Fish"], answerIndex: 1 },
            { id: "s1-q2", type: "mcq", question: "Spinach is a:", options: ["Root", "Stem", "Leaf", "Fruit"], answerIndex: 2 }
          ]
        },
        {
          id: "science-2",
          title: "Components of Food",
          difficulty: "Medium",
          estimatedMinutes: 17,
          summary: [
            "Different foods contain different nutrients.",
            "Deficiency diseases happen when nutrients are missing.",
            "A balanced diet supports growth and immunity."
          ],
          concepts: ["Nutrients", "Deficiency Diseases", "Balanced Diet", "Roughage"],
          diagram: "A plate chart showing portions of grains, vegetables, proteins and fruits.",
          videoPlaceholder: "Short explanation video: Balanced plate for kids.",
          text: "Our body needs nutrients for energy, growth and protection from diseases. Carbohydrates and fats give energy. Proteins help body growth and repair. Vitamins and minerals protect us from diseases. If a child does not get enough nutrients, deficiency diseases may occur. A balanced diet means taking all nutrients in proper amounts.",
          glossary: {
            deficiency: { meaning: "Lack of an essential nutrient.", pronunciation: "dih-fish-en-see" },
            balanced: { meaning: "In correct and healthy proportion.", pronunciation: "bal-uhn-st" },
            roughage: { meaning: "Fibrous food that helps digestion.", pronunciation: "ruff-ij" }
          },
          quiz: [
            { id: "s2-q1", type: "mcq", question: "Which nutrient helps body growth?", options: ["Protein", "Water", "Salt", "Fiber"], answerIndex: 0 },
            { id: "s2-q2", type: "mcq", question: "Deficiency disease is caused by:", options: ["Too much water", "Lack of nutrients", "Playing games", "Sleeping"], answerIndex: 1 }
          ]
        }
      ]
    }
  ],
  extraSubjects: [
    { id: "english", name: "English", status: "Coming Soon" },
    { id: "social-science", name: "Social Science", status: "Coming Soon" }
  ]
};
