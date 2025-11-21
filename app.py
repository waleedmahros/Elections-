from flask import Flask, request, jsonify
import requests
import re
from flask_cors import CORS

# إعداد تطبيق Flask وتفعيل CORS
app = Flask(__name__)
CORS(app) 

@app.route('/', methods=['POST'])
def proxy_inquiry():
    try:
        # استقبال الرقم القومي
        data = request.form.get('nid')
        if not data or len(data) != 14:
            return jsonify({'status': 'error', 'message': 'الرقم القومي غير صحيح.'}), 400
        nid = data
    except Exception:
        return jsonify({'status': 'error', 'message': 'خطأ في استقبال البيانات.'}), 400

    # إعداد الطلب للموقع الرسمي
    official_url = 'https://www.elections.eg/inquiry-mob'
    payload = {'nid': nid}
    
    # محاكاة متصفح حقيقي لتجنب الحظر
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.elections.eg/inquiry-mob',
        'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
    }

    try:
        # إرسال الطلب
        response = requests.post(official_url, data=payload, headers=headers, timeout=10)
        response.raise_for_status() 
        html_content = response.text

        # فحص حالات الفشل
        if "البيانات غير متوفرة" in html_content or "غير مسجل" in html_content:
            return jsonify({'status': 'error', 'message': 'الرقم القومي غير مسجل في قاعدة بيانات الناخبين.'}), 200

        # دالة استخراج البيانات باستخدام Regex (أكثر قوة من كود GAS)
        def find_value_after(html, keyword):
            regex = re.compile(keyword + r'.*?:\s*([^<]+)', re.I | re.DOTALL)
            match = regex.search(html)
            if match:
                value = match.group(1).strip()
                return re.sub(r'<[^>]*>', '', value).strip()
            return 'غير متوفر'

        # استخراج البيانات
        extracted_data = {}
        extracted_data['center'] = find_value_after(html_content, 'مركزك الإنتخابي')
        extracted_data['governorate'] = find_value_after(html_content, 'محافظة')
        extracted_data['section'] = find_value_after(html_content, 'قسم')
        extracted_data['address'] = find_value_after(html_content, 'العنوان')
        extracted_data['sub_committee'] = find_value_after(html_content, 'رقم اللجنة الفرعية')
        extracted_data['list_number'] = find_value_after(html_content, 'رقمك في الكشوف الانتخابية')
        
        return jsonify({'status': 'success', 'message': 'تم جلب البيانات بنجاح.', 'data': extracted_data}), 200

    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': f'فشل الاتصال بموقع الانتخابات: {str(e)}'}), 503
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'حدث خطأ غير متوقع: {str(e)}'}), 500

# لتشغيل التطبيق على Render
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
