/**
 * The Darz translation dictionary — `DICT` in `../../DarzStudio/darz_i18n.js`,
 * ported verbatim (144 entries, ten sections, its own section comments kept).
 *
 * Keys are the **exact English UI string**, whitespace-normalised. English is
 * the master source: a string that is not here stays English rather than
 * showing a key, which is the old engine's own graceful-degradation rule and
 * the reason the dictionary can be incomplete without breaking a screen.
 *
 * Translations use the international art-market register defined in
 * `../../DarzStudio/docs/design/DARZ_TRANSLATION_GLOSSARY.md`. Do not edit
 * them here to taste — the owner overrides per-string from the theme
 * (`theme.i18n`), which is the seam meant for that.
 *
 * **Do-not-translate holds by construction.** Only strings present here (or in
 * the owner's overrides) are ever substituted, so artist names, artwork
 * titles, prices, currencies, dates, dimensions and cataloguing references
 * pass through untouched — there is no heuristic that could mistake them.
 */

/** English source → per-language translation. */
export type Dictionary = Record<string, Partial<Record<string, string>>>;

export const DICT: Dictionary = {
  /* — Navigation — */
  Market: { fa: 'بازار', fr: 'Marché', es: 'Mercado', ar: 'السوق' },
  Auctions: { fa: 'حراج‌ها', fr: 'Enchères', es: 'Subastas', ar: 'المزادات' },
  Artists: { fa: 'هنرمندان', fr: 'Artistes', es: 'Artistas', ar: 'الفنانون' },
  Records: { fa: 'سوابق فروش', fr: 'Résultats', es: 'Resultados', ar: 'سجلّات المبيعات' },
  Highlights: { fa: 'برگزیده‌ها', fr: 'Sélection', es: 'Destacados', ar: 'أبرز الأعمال' },
  Insights: { fa: 'بینش‌ها', fr: 'Perspectives', es: 'Perspectivas', ar: 'رؤى' },
  Stories: { fa: 'روایت‌ها', fr: 'Récits', es: 'Historias', ar: 'حكايات' },
  'Insights & Stories': {
    fa: 'بینش‌ها و روایت‌ها',
    fr: 'Perspectives et récits',
    es: 'Perspectivas e historias',
    ar: 'رؤى وحكايات',
  },
  Profile: { fa: 'پروفایل', fr: 'Profil', es: 'Perfil', ar: 'الملف' },
  Settings: { fa: 'تنظیمات', fr: 'Paramètres', es: 'Ajustes', ar: 'الإعدادات' },
  Saved: { fa: 'ذخیره‌شده‌ها', fr: 'Enregistrés', es: 'Guardados', ar: 'المحفوظات' },

  /* — Actions / buttons — */
  'Buy now': { fa: 'خرید', fr: 'Acheter', es: 'Comprar', ar: 'اشترِ الآن' },
  '24h hold': {
    fa: 'رزرو ۲۴ ساعته',
    fr: 'Réserver 24 h',
    es: 'Reservar 24 h',
    ar: 'حجز ٢٤ ساعة',
  },
  'Request viewing': {
    fa: 'درخواست بازدید',
    fr: 'Demander une visite',
    es: 'Solicitar una visita',
    ar: 'طلب معاينة',
  },
  'Make an offer': {
    fa: 'ثبت پیشنهاد',
    fr: 'Faire une offre',
    es: 'Hacer una oferta',
    ar: 'تقديم عرض',
  },
  'Place a bid': { fa: 'ثبت پیشنهاد قیمت', fr: 'Enchérir', es: 'Pujar', ar: 'تقديم مزايدة' },
  'Request Price & Availability': {
    fa: 'استعلام قیمت و موجودی',
    fr: 'Demander le prix et la disponibilité',
    es: 'Solicitar precio y disponibilidad',
    ar: 'طلب السعر والتوفّر',
  },
  Save: { fa: 'ذخیره', fr: 'Enregistrer', es: 'Guardar', ar: 'حفظ' },
  Share: { fa: 'هم‌رسانی', fr: 'Partager', es: 'Compartir', ar: 'مشاركة' },
  Cancel: { fa: 'انصراف', fr: 'Annuler', es: 'Cancelar', ar: 'إلغاء' },
  Close: { fa: 'بستن', fr: 'Fermer', es: 'Cerrar', ar: 'إغلاق' },
  Continue: { fa: 'ادامه', fr: 'Continuer', es: 'Continuar', ar: 'متابعة' },
  Back: { fa: 'بازگشت', fr: 'Retour', es: 'Volver', ar: 'رجوع' },
  Send: { fa: 'ارسال', fr: 'Envoyer', es: 'Enviar', ar: 'إرسال' },
  Copy: { fa: 'کپی', fr: 'Copier', es: 'Copiar', ar: 'نسخ' },
  Done: { fa: 'انجام شد', fr: 'Terminé', es: 'Listo', ar: 'تم' },
  Search: { fa: 'جستجو', fr: 'Rechercher', es: 'Buscar', ar: 'بحث' },
  Filter: { fa: 'فیلتر', fr: 'Filtrer', es: 'Filtrar', ar: 'تصفية' },
  Sort: { fa: 'مرتب‌سازی', fr: 'Trier', es: 'Ordenar', ar: 'ترتيب' },
  Clear: { fa: 'پاک‌کردن', fr: 'Effacer', es: 'Borrar', ar: 'مسح' },
  'View in a Room': {
    fa: 'نمایش در فضا',
    fr: 'Voir dans une pièce',
    es: 'Ver en una sala',
    ar: 'المعاينة في غرفة',
  },
  'More by this artist': {
    fa: 'آثار بیشتر از این هنرمند',
    fr: 'Autres œuvres de cet artiste',
    es: 'Más de este artista',
    ar: 'أعمال أخرى لهذا الفنان',
  },

  /* — Prices / availability — */
  'Price on request': {
    fa: 'قیمت بر اساس استعلام',
    fr: 'Prix sur demande',
    es: 'Precio a consultar',
    ar: 'السعر عند الطلب',
  },
  Availability: { fa: 'موجودی', fr: 'Disponibilité', es: 'Disponibilidad', ar: 'التوفّر' },
  Available: { fa: 'موجود', fr: 'Disponible', es: 'Disponible', ar: 'متوفّر' },
  Sold: { fa: 'فروخته شد', fr: 'Vendu', es: 'Vendido', ar: 'بيع' },
  Reserved: { fa: 'رزرو شده', fr: 'Réservé', es: 'Reservado', ar: 'محجوز' },

  /* — Artwork spec labels — */
  Year: { fa: 'سال', fr: 'Année', es: 'Año', ar: 'السنة' },
  Size: { fa: 'ابعاد', fr: 'Dimensions', es: 'Dimensiones', ar: 'الأبعاد' },
  Medium: { fa: 'تکنیک', fr: 'Technique', es: 'Técnica', ar: 'الخامة' },
  Provenance: { fa: 'پیشینه', fr: 'Provenance', es: 'Procedencia', ar: 'مصدر التملّك' },
  Edition: { fa: 'نسخه', fr: 'Édition', es: 'Edición', ar: 'النسخة' },
  Currency: { fa: 'واحد پول', fr: 'Devise', es: 'Moneda', ar: 'العملة' },

  /* — Auctions — */
  'Current bid': {
    fa: 'پیشنهاد فعلی',
    fr: 'Enchère actuelle',
    es: 'Puja actual',
    ar: 'المزايدة الحالية',
  },
  'Maximum bid': {
    fa: 'حداکثر پیشنهاد',
    fr: 'Enchère maximale',
    es: 'Puja máxima',
    ar: 'الحد الأقصى للمزايدة',
  },
  'Closes in': { fa: 'پایان تا', fr: 'Clôture dans', es: 'Cierra en', ar: 'يُغلق خلال' },
  'Opens in': { fa: 'آغاز تا', fr: 'Ouvre dans', es: 'Abre en', ar: 'يفتح خلال' },
  Lot: { fa: 'لات', fr: 'Lot', es: 'Lote', ar: 'القطعة' },
  Ended: { fa: 'پایان‌یافته', fr: 'Terminée', es: 'Finalizada', ar: 'انتهى' },
  'Register for the Next Online Auction': {
    fa: 'ثبت‌نام برای حراج آنلاین بعدی',
    fr: 'S’inscrire à la prochaine vente en ligne',
    es: 'Regístrese para la próxima subasta en línea',
    ar: 'التسجيل في المزاد الإلكتروني القادم',
  },

  /* — Settings — */
  Preferences: { fa: 'ترجیحات', fr: 'Préférences', es: 'Preferencias', ar: 'التفضيلات' },
  NOTIFICATIONS: {
    fa: 'اعلان‌ها',
    fr: 'NOTIFICATIONS',
    es: 'NOTIFICACIONES',
    ar: 'الإشعارات',
  },
  DISPLAY: { fa: 'نمایش', fr: 'AFFICHAGE', es: 'PANTALLA', ar: 'العرض' },
  ACCOUNT: { fa: 'حساب کاربری', fr: 'COMPTE', es: 'CUENTA', ar: 'الحساب' },
  EDITORIAL: { fa: 'تحریریه', fr: 'ÉDITORIAL', es: 'EDITORIAL', ar: 'التحرير' },
  LEGAL: { fa: 'حقوقی', fr: 'MENTIONS LÉGALES', es: 'LEGAL', ar: 'قانوني' },
  'New arrivals': { fa: 'تازه‌ها', fr: 'Nouveautés', es: 'Novedades', ar: 'أعمال جديدة' },
  'When fresh works are listed': {
    fa: 'هنگام افزوده‌شدن آثار تازه',
    fr: 'Quand de nouvelles œuvres sont publiées',
    es: 'Cuando se publican obras nuevas',
    ar: 'عند إدراج أعمال جديدة',
  },
  'Auction reminders': {
    fa: 'یادآوری حراج',
    fr: 'Rappels d’enchères',
    es: 'Recordatorios de subasta',
    ar: 'تذكيرات المزاد',
  },
  'Before a lot you follow closes': {
    fa: 'پیش از پایان لاتی که دنبال می‌کنید',
    fr: 'Avant la clôture d’un lot que vous suivez',
    es: 'Antes de que cierre un lote que sigue',
    ar: 'قبل إغلاق قطعة تتابعها',
  },
  'Offer & request updates': {
    fa: 'به‌روزرسانی پیشنهادها و درخواست‌ها',
    fr: 'Suivi des offres et demandes',
    es: 'Novedades de ofertas y solicitudes',
    ar: 'تحديثات العروض والطلبات',
  },
  'Replies on your offers and requests': {
    fa: 'پاسخ به پیشنهادها و درخواست‌های شما',
    fr: 'Réponses à vos offres et demandes',
    es: 'Respuestas a sus ofertas y solicitudes',
    ar: 'الردود على عروضك وطلباتك',
  },
  'Push to this device': {
    fa: 'اعلان روی این دستگاه',
    fr: 'Notifications sur cet appareil',
    es: 'Notificaciones en este dispositivo',
    ar: 'تنبيهات هذا الجهاز',
  },
  Membership: { fa: 'عضویت', fr: 'Adhésion', es: 'Membresía', ar: 'العضوية' },
  'How prices are shown': {
    fa: 'نحوهٔ نمایش قیمت‌ها',
    fr: 'Affichage des prix',
    es: 'Cómo se muestran los precios',
    ar: 'طريقة عرض الأسعار',
  },
  Language: { fa: 'زبان', fr: 'Langue', es: 'Idioma', ar: 'اللغة' },
  'App language': {
    fa: 'زبان برنامه',
    fr: 'Langue de l’application',
    es: 'Idioma de la aplicación',
    ar: 'لغة التطبيق',
  },
  'Edit profile': {
    fa: 'ویرایش پروفایل',
    fr: 'Modifier le profil',
    es: 'Editar perfil',
    ar: 'تعديل الملف',
  },
  'Name, contact and collector details': {
    fa: 'نام، اطلاعات تماس و مشخصات کلکسیونر',
    fr: 'Nom, contact et informations de collectionneur',
    es: 'Nombre, contacto y datos de coleccionista',
    ar: 'الاسم وبيانات التواصل ومعلومات المقتني',
  },
  'Privacy & data': {
    fa: 'حریم خصوصی و داده‌ها',
    fr: 'Confidentialité et données',
    es: 'Privacidad y datos',
    ar: 'الخصوصية والبيانات',
  },
  'What we store and how it is used': {
    fa: 'چه چیزی نگه می‌داریم و چگونه استفاده می‌شود',
    fr: 'Ce que nous conservons et son usage',
    es: 'Qué guardamos y cómo se usa',
    ar: 'ما نحفظه وكيفية استخدامه',
  },
  'Get the app': {
    fa: 'نصب برنامه',
    fr: 'Installer l’application',
    es: 'Obtener la aplicación',
    ar: 'احصل على التطبيق',
  },
  'Market results, readings and conversations': {
    fa: 'نتایج بازار، یادداشت‌ها و گفت‌وگوها',
    fr: 'Résultats du marché, lectures et conversations',
    es: 'Resultados del mercado, lecturas y conversaciones',
    ar: 'نتائج السوق وقراءات ومحادثات',
  },
  'Terms & Conditions': {
    fa: 'شرایط و قوانین',
    fr: 'Conditions générales',
    es: 'Términos y condiciones',
    ar: 'الشروط والأحكام',
  },
  'How we work together': {
    fa: 'نحوهٔ همکاری ما',
    fr: 'Notre façon de collaborer',
    es: 'Cómo trabajamos juntos',
    ar: 'كيف نعمل معًا',
  },
  'Privacy Policy': {
    fa: 'سیاست حریم خصوصی',
    fr: 'Politique de confidentialité',
    es: 'Política de privacidad',
    ar: 'سياسة الخصوصية',
  },
  'Your data, kept close': {
    fa: 'داده‌های شما، نزد ما محفوظ',
    fr: 'Vos données, protégées',
    es: 'Sus datos, bien guardados',
    ar: 'بياناتك في حفظ أمين',
  },
  'Auction Terms': {
    fa: 'شرایط حراج',
    fr: 'Conditions des enchères',
    es: 'Términos de subasta',
    ar: 'شروط المزاد',
  },
  'How bidding works': {
    fa: 'نحوهٔ مزایده',
    fr: 'Comment enchérir',
    es: 'Cómo funciona la puja',
    ar: 'كيف تسير المزايدة',
  },
  'LEAVE THE ROOM': {
    fa: 'خروج از فضا',
    fr: 'QUITTER LA SALLE',
    es: 'SALIR DE LA SALA',
    ar: 'مغادرة القاعة',
  },
  'view & edit profile': {
    fa: 'مشاهده و ویرایش پروفایل',
    fr: 'voir et modifier le profil',
    es: 'ver y editar perfil',
    ar: 'عرض الملف وتعديله',
  },
  'View plans and your access to the private room': {
    fa: 'مشاهدهٔ طرح‌ها و دسترسی شما به فضای خصوصی',
    fr: 'Découvrez les formules et votre accès à la salle privée',
    es: 'Vea los planes y su acceso a la sala privada',
    ar: 'اطّلع على الباقات ووصولك إلى القاعة الخاصة',
  },

  /* — Profile anchors — */
  Overview: { fa: 'نمای کلی', fr: 'Aperçu', es: 'Resumen', ar: 'نظرة عامة' },
  Account: { fa: 'حساب', fr: 'Compte', es: 'Cuenta', ar: 'الحساب' },
  Activity: { fa: 'فعالیت', fr: 'Activité', es: 'Actividad', ar: 'النشاط' },
  Documents: { fa: 'اسناد', fr: 'Documents', es: 'Documentos', ar: 'المستندات' },
  Chat: { fa: 'گفت‌وگو', fr: 'Discussion', es: 'Chat', ar: 'محادثة' },

  /* — Gate / welcome / access — */
  'Welcome.': { fa: 'خوش آمدید.', fr: 'Bienvenue.', es: 'Bienvenido.', ar: 'مرحبًا.' },
  'Enter the Room': {
    fa: 'ورود به فضا',
    fr: 'Entrer dans la salle',
    es: 'Entrar en la sala',
    ar: 'ادخل القاعة',
  },
  'Request access': {
    fa: 'درخواست دسترسی',
    fr: 'Demander l’accès',
    es: 'Solicitar acceso',
    ar: 'طلب الوصول',
  },
  'First name': { fa: 'نام', fr: 'Prénom', es: 'Nombre', ar: 'الاسم الأول' },

  /* — v1035 coverage: discovery / detail / auctions / questionnaire / profile / common — */
  'All currencies': {
    fa: 'همهٔ ارزها',
    fr: 'Toutes les devises',
    es: 'Todas las monedas',
    ar: 'كل العملات',
  },
  'Recently added': {
    fa: 'جدیدترین‌ها',
    fr: 'Ajouts récents',
    es: 'Añadido recientemente',
    ar: 'أضيف حديثًا',
  },
  'Single view': { fa: 'نمای تکی', fr: 'Vue unique', es: 'Vista individual', ar: 'عرض مفرد' },
  'Grid view': {
    fa: 'نمای شبکه‌ای',
    fr: 'Vue en grille',
    es: 'Vista en cuadrícula',
    ar: 'عرض شبكي',
  },
  'Available Artworks': {
    fa: 'آثار موجود',
    fr: 'Œuvres disponibles',
    es: 'Obras disponibles',
    ar: 'الأعمال المتاحة',
  },
  Refine: { fa: 'پالایش', fr: 'Affiner', es: 'Refinar', ar: 'تنقية' },
  'Curated for You': {
    fa: 'برگزیده برای شما',
    fr: 'Sélection pour vous',
    es: 'Seleccionado para usted',
    ar: 'مختارات لك',
  },
  'Search artist, title, medium…': {
    fa: 'جستجوی هنرمند، عنوان، تکنیک…',
    fr: 'Rechercher artiste, titre, technique…',
    es: 'Buscar artista, título, técnica…',
    ar: 'ابحث بالفنان أو العنوان أو الخامة…',
  },
  LOADING: { fa: 'در حال بارگذاری', fr: 'CHARGEMENT', es: 'CARGANDO', ar: 'جارٍ التحميل' },
  'Loading…': {
    fa: 'در حال بارگذاری…',
    fr: 'Chargement…',
    es: 'Cargando…',
    ar: 'جارٍ التحميل…',
  },
  Install: { fa: 'نصب', fr: 'Installer', es: 'Instalar', ar: 'تثبيت' },
  Enquire: { fa: 'استعلام', fr: 'Se renseigner', es: 'Consultar', ar: 'الاستفسار' },
  Signed: { fa: 'امضاشده', fr: 'Signé', es: 'Firmado', ar: 'موقّع' },
  Framed: { fa: 'قاب‌شده', fr: 'Encadré', es: 'Enmarcado', ar: 'مؤطَّر' },
  Condition: { fa: 'وضعیت', fr: 'État', es: 'Estado', ar: 'الحالة' },
  Dimensions: { fa: 'ابعاد', fr: 'Dimensions', es: 'Dimensiones', ar: 'الأبعاد' },
  Details: { fa: 'جزئیات', fr: 'Détails', es: 'Detalles', ar: 'التفاصيل' },
  'About the work': {
    fa: 'دربارهٔ اثر',
    fr: 'À propos de l’œuvre',
    es: 'Sobre la obra',
    ar: 'عن العمل',
  },
  'More works': { fa: 'آثار بیشتر', fr: 'Plus d’œuvres', es: 'Más obras', ar: 'أعمال أخرى' },
  'Request price': {
    fa: 'استعلام قیمت',
    fr: 'Demander le prix',
    es: 'Solicitar precio',
    ar: 'طلب السعر',
  },
  'Starting bid': {
    fa: 'پیشنهاد آغازین',
    fr: 'Enchère de départ',
    es: 'Puja inicial',
    ar: 'المزايدة الافتتاحية',
  },
  Estimate: { fa: 'برآورد', fr: 'Estimation', es: 'Estimación', ar: 'التقدير' },
  Reserve: {
    fa: 'حداقل قیمت',
    fr: 'Prix de réserve',
    es: 'Precio de reserva',
    ar: 'السعر الاحتياطي',
  },
  'Reserve met': {
    fa: 'حداقل قیمت تأمین شد',
    fr: 'Prix de réserve atteint',
    es: 'Reserva alcanzada',
    ar: 'بلغ السعر الاحتياطي',
  },
  'Reserve not met': {
    fa: 'حداقل قیمت تأمین نشده',
    fr: 'Prix de réserve non atteint',
    es: 'Reserva no alcanzada',
    ar: 'لم يبلغ السعر الاحتياطي',
  },
  'Register to bid': {
    fa: 'ثبت‌نام برای مزایده',
    fr: 'S’inscrire pour enchérir',
    es: 'Regístrese para pujar',
    ar: 'سجّل للمزايدة',
  },
  'Bid history': {
    fa: 'تاریخچهٔ پیشنهادها',
    fr: 'Historique des enchères',
    es: 'Historial de pujas',
    ar: 'سجل المزايدات',
  },
  'Winning bid': {
    fa: 'پیشنهاد برنده',
    fr: 'Enchère gagnante',
    es: 'Puja ganadora',
    ar: 'المزايدة الفائزة',
  },
  'No bids yet': {
    fa: 'هنوز پیشنهادی ثبت نشده',
    fr: 'Aucune enchère pour l’instant',
    es: 'Aún no hay pujas',
    ar: 'لا مزايدات بعد',
  },
  Live: { fa: 'زنده', fr: 'En direct', es: 'En directo', ar: 'مباشر' },
  Upcoming: { fa: 'پیش‌رو', fr: 'À venir', es: 'Próximamente', ar: 'قادم' },
  Passed: { fa: 'فروخته‌نشده', fr: 'Invendu', es: 'No vendido', ar: 'لم يُبَع' },
  Withdrawn: { fa: 'برداشته‌شده', fr: 'Retiré', es: 'Retirado', ar: 'مسحوب' },
  Skip: { fa: 'رد کردن', fr: 'Passer', es: 'Omitir', ar: 'تخطٍّ' },
  Start: { fa: 'شروع', fr: 'Commencer', es: 'Comenzar', ar: 'ابدأ' },
  Submit: { fa: 'ثبت', fr: 'Envoyer', es: 'Enviar', ar: 'إرسال' },
  Review: { fa: 'بازبینی', fr: 'Vérifier', es: 'Revisar', ar: 'مراجعة' },
  Password: { fa: 'گذرواژه', fr: 'Mot de passe', es: 'Contraseña', ar: 'كلمة المرور' },
  'Write to Darz…': {
    fa: 'برای درز بنویسید…',
    fr: 'Écrire à Darz…',
    es: 'Escriba a Darz…',
    ar: 'اكتب إلى دارز…',
  },
  'Reply from Darz': {
    fa: 'پاسخ از درز',
    fr: 'Réponse de Darz',
    es: 'Respuesta de Darz',
    ar: 'رد من دارز',
  },
  'No activity yet': {
    fa: 'هنوز فعالیتی نیست',
    fr: 'Aucune activité pour l’instant',
    es: 'Aún no hay actividad',
    ar: 'لا نشاط بعد',
  },
  Confirm: { fa: 'تأیید', fr: 'Confirmer', es: 'Confirmar', ar: 'تأكيد' },
  Copied: { fa: 'کپی شد', fr: 'Copié', es: 'Copiado', ar: 'تم النسخ' },
  'Nothing here yet': {
    fa: 'هنوز چیزی اینجا نیست',
    fr: 'Rien ici pour l’instant',
    es: 'Nada aquí todavía',
    ar: 'لا شيء هنا بعد',
  },
  'No saved works yet': {
    fa: 'هنوز اثری ذخیره نشده',
    fr: 'Aucune œuvre enregistrée',
    es: 'Aún no hay obras guardadas',
    ar: 'لا أعمال محفوظة بعد',
  },
  'Try again': { fa: 'تلاش دوباره', fr: 'Réessayer', es: 'Reintentar', ar: 'أعد المحاولة' },
  Refresh: { fa: 'بازخوانی', fr: 'Actualiser', es: 'Actualizar', ar: 'تحديث' },
  'Update now': {
    fa: 'اکنون به‌روزرسانی کن',
    fr: 'Mettre à jour',
    es: 'Actualizar ahora',
    ar: 'حدّث الآن',
  },
  Removed: { fa: 'حذف شد', fr: 'Supprimé', es: 'Eliminado', ar: 'أُزيل' },
  /* — theme content: hero + About (live values; owner can re-translate in Admin → Languages if they edit the copy) — */
  'curated collection': {
    fa: 'مجموعهٔ برگزیده',
    fr: 'collection choisie',
    es: 'colección curada',
    ar: 'مجموعة مختارة',
  },
  'Contemporary Iranian works, available through darzmarket.art': {
    fa: 'آثار معاصر ایرانی، از طریق darzmarket.art در دسترس',
    fr: 'Œuvres iraniennes contemporaines, disponibles via darzmarket.art',
    es: 'Obras iraníes contemporáneas, disponibles a través de darzmarket.art',
    ar: 'أعمال إيرانية معاصرة، متاحة عبر darzmarket.art',
  },
  'About Darz Market App': {
    fa: 'دربارهٔ اپلیکیشن درز مارکت',
    fr: 'À propos de l’application Darz Market',
    es: 'Acerca de la aplicación Darz Market',
    ar: 'عن تطبيق دارز ماركت',
  },
  'Darz is the market branch of darz.art — a curated platform for discovering, collecting and bidding on contemporary Iranian art. Every work is verified, every transaction handled with care, and our specialists are always a message away.':
    {
      fa: 'درز شاخهٔ بازارِ darz.art است — بستری برگزیده برای کشف، گردآوری و شرکت در حراج آثار هنری معاصر ایران. هر اثر تأیید می‌شود، هر معامله با دقت انجام می‌گیرد و کارشناسان ما همیشه با یک پیام در دسترس‌اند.',
      fr: 'Darz est la branche marché de darz.art — une plateforme choisie pour découvrir, collectionner et enchérir sur l’art iranien contemporain. Chaque œuvre est authentifiée, chaque transaction menée avec soin, et nos spécialistes sont toujours à un message près.',
      es: 'Darz es la rama de mercado de darz.art — una plataforma curada para descubrir, coleccionar y pujar por arte iraní contemporáneo. Cada obra está verificada, cada transacción se gestiona con cuidado, y nuestros especialistas están siempre a un mensaje de distancia.',
      ar: 'دارز هو الفرع التجاري لـ darz.art — منصّة مختارة لاكتشاف الفن الإيراني المعاصر واقتنائه والمزايدة عليه. كل عمل موثّق، وكل معاملة تُدار بعناية، وخبراؤنا دائمًا على بُعد رسالة.',
    },
};
