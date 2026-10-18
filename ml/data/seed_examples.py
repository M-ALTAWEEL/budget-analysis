"""Hand-labelled seed data for the expense categorizer.

Why hand-written? A brand-new app has no users and no expenses yet (the "cold start"
problem), so the model needs a first set of labelled examples to learn from. Once
students use the app, every category they pick (or correct) becomes a new example.

Rules followed while writing these:
- the 8 built-in categories (their slugs), in English, Arabic and Turkish
- how students really type: short, lowercase, brand names, a few typos ("netflx")
- not balanced on purpose: food is the most common expense in real life
Run `python build_dataset.py` to turn this into expenses.csv.
"""

DATA: dict[str, dict[str, list[str]]] = {
    "food": {
        "en": [
            "shawarma", "shawrma wrap", "lunch at uni cafeteria", "coffee", "starbucks latte",
            "groceries at migros", "bim groceries", "a101 bread and milk", "pizza with friends",
            "burger king", "mcdonalds", "dinner", "breakfast", "simit and tea", "getir order",
            "yemeksepeti order", "doner", "kebab", "water bottle", "snacks", "chocolate bar",
            "fruit and vegetables", "eggs and bread", "chicken wrap", "sushi", "ice cream",
            "energy drink", "restaurant", "takeaway noodles", "falafel", "bakery", "pasta",
            "rice and chicken", "cafe with friends", "orange juice", "supermarket", "milk",
            "cheese and olives", "kfc bucket", "dominos pizza", "tea", "lunch", "groceries",
        ],
        "ar": [
            "شاورما", "سندويشة شاورما", "غدا بكافتيريا الجامعة", "قهوة", "ستاربكس", "خضرة وفواكه",
            "بقالة", "خبز وحليب", "بيتزا مع الشباب", "برغر", "عشاء", "فطور", "سميت وشاي",
            "طلب من يمك سبيتي", "طلبية غيتير", "كباب", "فلافل", "مشروبات غازية", "شوكولا",
            "فروج", "رز ودجاج", "حلويات", "مطعم", "كنافة", "عصير", "سوبرماركت", "شاي",
            "مي", "سلطة", "فول وحمص", "مشاوي", "قهوة مع الاصحاب", "غدا", "اكل", "ميغروس",
            "بيم", "بيض وجبنة", "كيك",
        ],
        "tr": [
            "döner", "öğle yemeği yemekhane", "kahve", "çay simit", "market alışverişi", "migros",
            "bim alışveriş", "a101 ekmek süt", "pizza", "hamburger", "akşam yemeği", "kahvaltı",
            "yemeksepeti siparişi", "getir siparişi", "kebap", "lahmacun", "su", "atıştırmalık",
            "çikolata", "meyve sebze", "tavuk dürüm", "tatlı", "baklava", "dondurma", "ayran",
            "restoran", "pide", "köfte", "manav", "kafe", "börek", "tost", "çorba", "yemek",
        ],
    },
    "transport": {
        "en": [
            "istanbulkart top up", "istanbulkart", "bus ticket", "metro", "taxi", "uber",
            "bitaksi", "flight ticket", "train ticket", "ferry", "marmaray", "fuel", "gas for car",
            "parking", "scooter rental", "marti scooter", "dolmus", "airport shuttle", "havaist",
            "car rental", "metrobus", "bus to campus", "taxi home", "plane ticket to dubai",
            "petrol",
        ],
        "ar": [
            "تعبئة اسطنبول كارت", "اسطنبول كارت", "باص", "مترو", "تكسي", "اوبر", "تذكرة طيران",
            "قطار", "عبارة", "بنزين", "موقف سيارات", "سكوتر", "دولموش", "باص المطار",
            "مواصلات للجامعة", "تكسي للبيت", "تذكرة باص", "مترو بوس", "شحن الكارت",
        ],
        "tr": [
            "istanbulkart dolum", "otobüs", "metro", "taksi", "bitaksi", "uçak bileti",
            "tren bileti", "vapur", "benzin", "otopark", "martı", "dolmuş", "havaist",
            "araç kiralama", "metrobüs", "otobüs bileti", "akbil", "yol parası",
        ],
    },
    "study": {
        "en": [
            "textbook", "notebooks and pens", "printing", "photocopies", "course fee",
            "udemy course", "tuition installment", "library fine", "calculator", "stationery",
            "flash drive", "highlighters", "school supplies", "english course", "exam fee",
            "coursera", "lab coat", "lecture notes", "graph paper", "printer ink",
        ],
        "ar": [
            "كتاب جامعي", "دفاتر واقلام", "طباعة", "تصوير اوراق", "رسوم كورس", "كورس يوديمي",
            "قسط الجامعة", "آلة حاسبة", "قرطاسية", "فلاشة", "رسوم امتحان", "كورس انجليزي",
            "ملخصات", "مستلزمات الجامعة", "طباعة مشروع", "كتاب",
        ],
        "tr": [
            "ders kitabı", "defter kalem", "fotokopi", "çıktı", "kurs ücreti", "udemy kursu",
            "okul taksiti", "hesap makinesi", "kırtasiye", "usb bellek", "sınav ücreti",
            "ingilizce kursu", "ders notları", "kitap",
        ],
    },
    "entertainment": {
        "en": [
            "netflix", "netflx", "spotify", "cinema tickets", "movie", "bowling",
            "playstation game", "steam game", "concert ticket", "youtube premium",
            "football match ticket", "escape room", "karaoke", "museum entry",
            "amusement park", "disney plus", "billiards", "theater", "ps plus", "festival",
        ],
        "ar": [
            "نتفليكس", "سبوتيفاي", "سينما", "بولينغ", "لعبة بلايستيشن", "ستيم", "حفلة",
            "يوتيوب بريميوم", "تذكرة مباراة", "ملاهي", "متحف", "بلياردو", "مسرح",
            "اشتراك العاب", "طلعة مع الشباب", "فيلم",
        ],
        "tr": [
            "netflix üyeliği", "spotify", "sinema bileti", "bowling", "oyun", "konser bileti",
            "maç bileti", "lunapark", "müze girişi", "bilardo", "tiyatro", "exxen", "blutv",
            "film",
        ],
    },
    "shopping": {
        "en": [
            "t-shirt", "jeans", "shoes", "trendyol order", "hepsiburada", "amazon order",
            "phone case", "headphones", "zara", "h&m", "lc waikiki", "backpack", "perfume",
            "shampoo", "toothpaste", "detergent", "sunglasses", "jacket", "gift for a friend",
            "watch", "ikea", "towels", "charger cable", "sneakers",
        ],
        "ar": [
            "تيشيرت", "بنطلون جينز", "حذاء", "طلبية ترينديول", "كفر موبايل", "سماعات", "زارا",
            "شنطة ظهر", "عطر", "شامبو", "معجون اسنان", "منظفات", "نظارة شمسية", "جاكيت",
            "هدية لصديق", "مناشف", "شاحن", "ملابس",
        ],
        "tr": [
            "tişört", "kot pantolon", "ayakkabı", "trendyol siparişi", "hepsiburada",
            "telefon kılıfı", "kulaklık", "zara", "lc waikiki", "sırt çantası", "parfüm",
            "şampuan", "diş macunu", "deterjan", "güneş gözlüğü", "mont", "hediye", "havlu",
            "şarj aleti", "kıyafet",
        ],
    },
    "health": {
        "en": [
            "pharmacy", "painkillers", "vitamins", "doctor visit", "dentist", "hospital fee",
            "gym membership", "glasses", "contact lenses", "blood test", "cold medicine",
            "physiotherapy", "protein powder", "panadol", "health insurance",
        ],
        "ar": [
            "صيدلية", "مسكن", "فيتامينات", "مراجعة دكتور", "طبيب اسنان", "مستشفى",
            "اشتراك جيم", "نظارة طبية", "عدسات", "تحليل دم", "دوا رشح", "علاج فيزيائي",
            "دواء", "بنادول",
        ],
        "tr": [
            "eczane", "ağrı kesici", "vitamin", "doktor muayenesi", "diş hekimi", "hastane",
            "spor salonu üyeliği", "gözlük", "lens", "kan tahlili", "grip ilacı",
            "fizik tedavi", "ilaç",
        ],
    },
    "bills": {
        "en": [
            "phone bill", "internet bill", "electricity bill", "water bill", "gas bill", "rent",
            "dorm fee", "turkcell package", "vodafone", "mobile data top up", "icloud storage",
            "google one", "building fees", "residence permit fee", "bank fee",
        ],
        "ar": [
            "فاتورة موبايل", "فاتورة انترنت", "كهربا", "فاتورة مي", "غاز", "ايجار البيت",
            "سكن طلاب", "باقة تركسل", "شحن رصيد", "عائدات", "رسوم اقامة", "رسوم بنك",
            "آي كلاود", "انترنت",
        ],
        "tr": [
            "telefon faturası", "internet faturası", "elektrik faturası", "su faturası",
            "doğalgaz", "kira", "yurt ücreti", "turkcell paket", "vodafone", "tl yükleme",
            "aidat", "ikamet harcı", "banka masrafı",
        ],
    },
    "other": {
        "en": [
            "haircut", "donation", "laundry", "passport photos", "notary", "cargo shipping",
            "tip", "lent money to a friend", "atm fee",
        ],
        "ar": ["حلاق", "تبرع", "غسيل ملابس", "صور شخصية", "كاتب عدل", "شحن طرد", "بقشيش", "دين لصديق"],
        "tr": ["berber", "bağış", "çamaşırhane", "vesikalık fotoğraf", "noter", "kargo", "bahşiş", "arkadaşa borç"],
    },
}


# ── Round 2 ──────────────────────────────────────────────────────────────────
# The learning curve of round 1 was still rising: more data would help. Round 2 adds
# the everyday vocabulary a student uses (and that anyone "just knows"): bus, taxi,
# metro and tram are transport; tea, juice, water, vegetables and fruit are food; gas,
# electricity, internet and building fees are bills. Same concepts in all 3 languages.

# Written by Mohammed (a real student, his own words): the first real data we have.
FROM_MOHAMMED: dict[str, list[str]] = {
    "transport": ["باص", "تكسي", "مترو", "ترام"],
    "food": ["شاي", "عصير", "مي", "خضار", "فواكة"],
    "bills": ["غاز", "كهربا", "نت", "فواتير", "عائدات"],
}

ROUND_2: dict[str, dict[str, list[str]]] = {
    "food": {
        "en": [
            "tea", "juice", "vegetables", "fruits", "apples", "bananas", "tomatoes", "potatoes",
            "onions", "bread", "rice", "chicken", "meat", "fish", "yogurt", "butter", "honey",
            "cereal", "nuts", "chips", "biscuits", "cookies", "cola", "soda", "red bull",
            "espresso", "cappuccino", "turkish coffee", "nescafe", "takeaway", "food delivery",
            "dinner out", "lunch with classmates", "brunch", "street food", "sandwich", "salad",
            "soup", "chicken doner", "dessert", "candy", "olive oil", "sugar", "flour",
            "tuna can", "frozen pizza", "weekly groceries", "market", "fruit juice",
        ],
        "ar": [
            "مية", "فواكه", "تفاح", "موز", "بندورة", "بطاطا", "بصل", "خبز", "رز", "معكرونة",
            "دجاج", "لحمة", "سمك", "لبن", "زبدة", "عسل", "مربى", "كورن فليكس", "مكسرات", "شيبس",
            "بسكويت", "كولا", "بيبسي", "قهوة تركية", "نسكافيه", "كابتشينو", "ديليفري اكل",
            "عشا برا", "غدا مع الزملاء", "سندويشة", "شوربة", "شاورما دجاج", "معجنات", "فطاير",
            "بوظة", "سكاكر", "زيت زيتون", "سكر", "طحين", "تونة", "اغراض البيت", "تسوق اسبوعي",
            "خضرجي", "فرن", "مناقيش", "عشا", "ترويقة",
        ],
        "tr": [
            "çay", "meyve suyu", "su şişesi", "sebze", "meyve", "elma", "muz", "domates",
            "patates", "soğan", "ekmek", "pirinç", "makarna", "tavuk", "et", "balık", "yoğurt",
            "tereyağı", "bal", "reçel", "kuruyemiş", "cips", "bisküvi", "kola", "türk kahvesi",
            "nescafe", "latte", "sandviç", "salata", "tavuk döner", "simit", "poğaça", "pasta",
            "şeker", "zeytinyağı", "ton balığı", "haftalık market", "şok market", "fırın",
            "kumpir", "mantı", "lokanta",
        ],
    },
    "transport": {
        "en": [
            "tram", "tram ticket", "bus fare", "subway", "metro card", "taxi ride", "cab",
            "uber ride", "ride to campus", "bus pass", "monthly transport card",
            "student transport card", "ferry ticket", "boat", "intercity bus", "airport taxi",
            "diesel", "car wash", "bike repair", "highway toll", "e-scooter", "train",
            "high speed train", "pegasus flight", "turkish airlines", "flight",
        ],
        "ar": [
            "تذكرة ترام", "اجرة باص", "مترو الانفاق", "تاكسي", "تكسي للجامعة", "اوبر للبيت",
            "توصيلة", "كرت المواصلات", "اشتراك مواصلات شهري", "عبارة بحرية", "باص بين المدن",
            "تذكرة باص سفر", "تكسي المطار", "مازوت", "غسيل سيارة", "تصليح بسكليت", "رسوم طريق",
            "سكوتر كهربائي", "قطار سريع", "طيران", "حجز طيران", "تذكرة سفر", "مواصلات",
        ],
        "tr": [
            "tramvay", "tramvay bileti", "otobüs parası", "taksi ücreti", "uber",
            "kampüse ulaşım", "aylık abonman", "öğrenci kart dolum", "vapur bileti",
            "deniz otobüsü", "şehirlerarası otobüs", "obilet", "havalimanı taksi", "mazot",
            "araba yıkama", "bisiklet tamiri", "köprü geçişi", "scooter", "hızlı tren",
            "pegasus", "thy bilet", "uçak", "ulaşım",
        ],
    },
    "bills": {
        "en": [
            "gas", "natural gas bill", "electricity", "power bill", "internet", "wifi bill",
            "home internet", "mobile bill", "phone credit", "sim card", "rent payment",
            "monthly rent", "apartment rent", "dormitory", "building maintenance fee", "aidat",
            "utilities", "heating", "turk telekom", "superonline", "bills", "insurance",
            "visa fee", "card annual fee",
        ],
        "ar": [
            "فاتورة غاز", "كهرباء", "فاتورة كهرباء", "كهربا البيت", "فاتورة النت", "واي فاي",
            "انترنت البيت", "رصيد", "شريحة", "خط موبايل", "ايجار", "اجار الشهر", "قسط السكن",
            "سكن جامعي", "عائدات البناية", "مصاريف البناية", "تدفئة", "ترك تيليكوم",
            "سوبر اونلاين", "فاتورة تركسل", "فاتورة", "تأمين", "رسوم الفيزا",
        ],
        "tr": [
            "doğalgaz faturası", "elektrik", "fatura", "faturalar", "wifi", "ev interneti",
            "telefon faturası ödeme", "kontör", "sim kart", "kira ödemesi", "ev kirası", "yurt",
            "apartman aidatı", "site aidatı", "ısınma", "türk telekom", "superonline",
            "turkcell fatura", "sigorta", "ikamet kartı", "vize ücreti",
        ],
    },
    "study": {
        "en": [
            "books", "course book", "pdf notes", "printing assignment", "copy center", "pens",
            "pencils", "eraser", "ruler", "folder", "a4 paper", "notebook", "tuition",
            "semester fee", "registration fee", "ielts exam", "toefl", "online course",
            "programming course", "software license", "lab materials", "drawing supplies",
            "thesis printing", "graduation project", "library",
        ],
        "ar": [
            "كتب", "كتاب الجامعة", "نوط", "طباعة واجب", "مكتبة تصوير", "قلم", "اقلام", "ممحاة",
            "مسطرة", "دوسية", "ورق", "دفتر", "رسوم الفصل", "رسوم التسجيل", "امتحان ايلتس",
            "توفل", "كورس اونلاين", "كورس برمجة", "مواد مختبر", "ادوات رسم",
            "طباعة مشروع التخرج", "مكتبة الجامعة", "قرطاسية للجامعة",
        ],
        "tr": [
            "kitaplar", "ders notu", "ödev çıktısı", "fotokopi merkezi", "kalem", "silgi",
            "cetvel", "dosya", "a4 kağıt", "defter", "dönem ücreti", "kayıt ücreti",
            "ielts sınavı", "online kurs", "yazılım kursu", "laboratuvar malzemesi",
            "çizim malzemesi", "bitirme projesi", "kütüphane", "kırtasiye alışverişi",
        ],
    },
    "entertainment": {
        "en": [
            "movies", "netflix subscription", "spotify premium", "apple music", "games",
            "video game", "ps5 game", "xbox game pass", "steam sale", "valorant points",
            "pubg uc", "concert", "party", "night out", "club entry", "hookah", "shisha",
            "trip with friends", "day trip", "boat tour", "paintball", "go kart", "zoo",
            "aquarium",
        ],
        "ar": [
            "افلام", "اشتراك نتفليكس", "سبوتيفاي بريميوم", "العاب", "لعبة", "بلايستيشن",
            "شحن شدات ببجي", "شحن فالورانت", "سهرة", "حفلة مع الاصحاب", "ارجيلة", "اركيلة",
            "رحلة", "رحلة مع الشباب", "جولة بالبحر", "كارتينغ", "حديقة الحيوان", "اكواريوم",
            "بلايستيشن كافيه", "كاراوكي",
        ],
        "tr": [
            "filmler", "netflix aboneliği", "spotify premium", "oyunlar", "ps5 oyun",
            "valorant vp", "pubg uc", "parti", "gece çıkışı", "nargile", "gezi",
            "arkadaşlarla gezi", "tekne turu", "karting", "hayvanat bahçesi", "akvaryum",
            "ps cafe", "konser", "eğlence",
        ],
    },
    "shopping": {
        "en": [
            "clothes", "new clothes", "shirt", "hoodie", "socks", "boots", "coat", "dress",
            "skirt", "bag", "wallet", "belt", "cap", "power bank", "usb cable", "mouse",
            "keyboard", "earbuds", "makeup", "skincare", "deodorant", "razor", "soap",
            "toilet paper", "tissues", "cleaning supplies", "dish soap", "kitchen stuff",
            "plates", "bedsheets", "pillow", "lamp",
        ],
        "ar": [
            "اواعي", "قميص", "هودي", "كنزة", "جرابات", "بوط", "معطف", "فستان", "تنورة",
            "شنتاية", "محفظة", "قشاط", "كاب", "باور بانك", "كيبل", "ماوس", "كيبورد", "ايربودز",
            "مكياج", "كريم", "مزيل عرق", "شفرات حلاقة", "صابون", "محارم", "ورق تواليت",
            "مواد تنظيف", "اغراض مطبخ", "صحون", "شرشف", "مخدة", "ديكور",
        ],
        "tr": [
            "kıyafet", "gömlek", "kazak", "çorap", "bot", "elbise", "etek", "çanta", "cüzdan",
            "kemer", "şapka", "powerbank", "kablo", "klavye", "airpods", "makyaj", "kozmetik",
            "krem", "deodorant", "jilet", "sabun", "peçete", "tuvalet kağıdı",
            "temizlik malzemesi", "bulaşık deterjanı", "mutfak eşyası", "tabak", "nevresim",
            "yastık", "lamba", "watsons", "gratis", "rossmann",
        ],
    },
    "health": {
        "en": [
            "medicine", "pills", "antibiotics", "doctor", "clinic", "checkup",
            "dental cleaning", "tooth filling", "eye exam", "x-ray", "allergy medicine",
            "cough syrup", "bandages", "gym", "fitness", "swimming pool", "yoga class",
            "therapy session", "psychologist", "prescription",
        ],
        "ar": [
            "ادوية", "حبوب", "مضاد حيوي", "مستوصف", "عيادة", "طبيب", "كشفية", "تنظيف اسنان",
            "حشوة سن", "فحص نظر", "صورة اشعة", "دوا حساسية", "شراب كحة", "لزقات", "جيم",
            "نادي رياضي", "مسبح", "يوغا", "جلسة علاج", "اخصائي نفسي", "وصفة طبية",
        ],
        "tr": [
            "ilaçlar", "antibiyotik", "klinik", "doktor", "check up", "diş temizliği", "dolgu",
            "göz muayenesi", "röntgen", "alerji ilacı", "öksürük şurubu", "yara bandı",
            "fitness", "yüzme havuzu", "yoga dersi", "terapi", "psikolog", "reçete",
        ],
    },
    "other": {
        "en": [
            "gift money", "wedding gift", "charity", "zakat", "fine", "traffic fine",
            "phone repair", "repair", "dry cleaning", "barber", "salon", "post office",
            "photo printing", "key copy", "moving", "misc",
        ],
        "ar": [
            "عيدية", "هدية عرس", "صدقة", "زكاة", "مخالفة", "مخالفة سير", "تصليح موبايل", "تصليح",
            "دراي كلين", "صالون", "بريد", "طباعة صور", "نسخ مفتاح", "نقل اغراض", "متفرقات",
        ],
        "tr": [
            "düğün hediyesi", "sadaka", "zekat", "ceza", "trafik cezası", "telefon tamiri",
            "tamir", "kuru temizleme", "kuaför", "ptt", "fotoğraf baskı", "anahtar kopyalama",
            "nakliye", "çeşitli",
        ],
    },
}
