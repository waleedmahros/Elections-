// استيراد مكتبة Fetch للاتصال بموقع الانتخابات
const fetch = require('node-fetch');

// هذه هي الدالة التي ستعمل كـ API على Vercel
module.exports = async (req, res) => {
    // إعداد رأس الاستجابة لتمكين CORS (للسماح لصفحة GitHub بالاتصال)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // 1. استقبال الرقم القومي من طلب POST
    if (req.method !== 'POST' || !req.body) {
        return res.status(400).send(JSON.stringify({ status: 'error', message: 'يجب أن يكون الطلب POST ويحتوي على بيانات.' }));
    }
    
    // Vercel يحتاج طريقة خاصة لقراءة الـ FormData
    const body = new URLSearchParams(req.body); 
    const nid = body.get('nid');

    if (!nid || nid.length !== 14) {
        return res.status(400).send(JSON.stringify({ status: 'error', message: 'الرقم القومي غير صحيح.' }));
    }

    // 2. إعداد الطلب للموقع الرسمي
    const officialUrl = 'https://www.elections.eg/inquiry-mob';
    const payload = new URLSearchParams();
    payload.append('nid', nid);

    // 3. إعداد Headers لمحاكاة متصفح حقيقي
    const options = {
        method: 'POST',
        body: payload,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.elections.eg/inquiry-mob',
        },
    };

    try {
        const response = await fetch(officialUrl, options);
        const htmlContent = await response.text();

        // 4. فحص حالات الفشل
        if (htmlContent.includes("البيانات غير متوفرة") || htmlContent.includes("غير مسجل")) {
            return res.status(200).send(JSON.stringify({ status: 'error', message: 'الرقم القومي غير مسجل في قاعدة بيانات الناخبين.' }));
        }

        // 5. دالة استخراج البيانات (نستخدم RegExp كما في الكود السابق)
        const findValueAfter = (html, keyword) => {
            const regex = new RegExp(keyword + '.*?:\\s*([^<]+)', 'si');
            const match = html.match(regex);
            if (match && match[1]) {
                // تنظيف القيمة
                let value = match[1].trim();
                return value.replace(/<\/?(div|span|p|b)>/g, '').trim();
            }
            return 'غير متوفر';
        };

        // 6. استخراج البيانات
        const extractedData = {};
        extractedData.center = findValueAfter(htmlContent, 'مركزك الإنتخابي');
        extractedData.governorate = findValueAfter(htmlContent, 'محافظة');
        extractedData.section = findValueAfter(htmlContent, 'قسم');
        extractedData.address = findValueAfter(htmlContent, 'العنوان');
        extractedData.sub_committee = findValueAfter(htmlContent, 'رقم اللجنة الفرعية');
        extractedData.list_number = findValueAfter(htmlContent, 'رقمك في الكشوف الانتخابية');

        // 7. إرجاع النتيجة بنجاح
        return res.status(200).send(JSON.stringify({ status: 'success', message: 'تم جلب البيانات بنجاح.', data: extractedData }));

    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(503).send(JSON.stringify({ status: 'error', message: 'فشل في الاتصال بموقع الانتخابات الرسمي. يرجى المحاولة لاحقاً.' }));
    }
};
