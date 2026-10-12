/*
 * داده‌های مشترک سایت — برای اضافه کردن یک استان جدید فقط همین‌جا را تغییر بدهید.
 * 1) نام فارسی در PROVINCE_NAMES (از قبل همه ۳۱ استان هست)
 * 2) شناسه استان را به ACTIVE_PROVINCES اضافه کنید و فایل provinces/<id>.html را بسازید
 */
const PROVINCE_NAMES = {
    "alborz": "البرز",
    "ardabil": "اردبیل",
    "azerbaijan-east": "آذربایجان شرقی",
    "azerbaijan-west": "آذربایجان غربی",
    "bushehr": "بوشهر",
    "chaharmahal-bakhriari": "چهارمحال و بختیاری",
    "fars": "فارس",
    "gilan": "گیلان",
    "golestan": "گلستان",
    "hamadan": "همدان",
    "hormozgan": "هرمزگان",
    "ilam": "ایلام",
    "isfahan": "اصفهان",
    "kerman": "کرمان",
    "kermanshah": "کرمانشاه",
    "khorasan-north": "خراسان شمالی",
    "khorasan-razavi": "خراسان رضوی",
    "khorasan-south": "خراسان جنوبی",
    "khuzestan": "خوزستان",
    "kohgiluye-boyerahmad": "کهگیلویه و بویراحمد",
    "kurdistan": "کردستان",
    "lorestan": "لرستان",
    "markazi": "مرکزی",
    "mazandaran": "مازندران",
    "qazvin": "قزوین",
    "qom": "قم",
    "semnan": "سمنان",
    "sistan-baluchestan": "سیستان و بلوچستان",
    "tehran": "تهران",
    "yazd": "یزد",
    "zanjan": "زنجان"
};

const ACTIVE_PROVINCES = [
    "fars",
    "azerbaijan-west",
    "gilan",
    "hamadan",
    "isfahan",
    "khuzestan",
    "qazvin",
    "tehran",
    "yazd"
];
