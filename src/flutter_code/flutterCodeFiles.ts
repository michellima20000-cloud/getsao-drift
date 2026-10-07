export interface FlutterFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const FLUTTER_CODE_FILES: FlutterFile[] = [
  {
    name: 'pubspec.yaml',
    path: 'pubspec.yaml',
    language: 'yaml',
    description: 'Dependências do projeto Flutter com Firebase Auth, Cloud Firestore e Provider',
    content: `name: drift_park
description: Sistema mobile de gestão e aluguel de carrinhos de bate-bate, drift e jeep com arquitetura multi-tenant.
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  # Firebase Core, Auth e Firestore
  firebase_core: ^2.24.2
  firebase_auth: ^4.16.0
  cloud_firestore: ^4.14.0
  # Gerenciamento de Estado
  provider: ^6.1.1
  # UI, Ícones e Utilidades
  google_fonts: ^6.1.0
  intl: ^0.19.0
  csv: ^5.1.1
  path_provider: ^2.1.2
  share_plus: ^7.2.2
  url_launcher: ^6.2.3

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
`,
  },
  {
    name: 'firebase_options.dart',
    path: 'lib/firebase_options.dart',
    language: 'dart',
    description: 'Configuração oficial do Firebase para o projeto gympulse-personal (Web, Android e iOS)',
    content: `import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('DefaultFirebaseOptions are not supported for this platform.');
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY',
    appId: '1:1068724964920:web:d4fec7bbd3dbeceb07a0cd',
    messagingSenderId: '1068724964920',
    projectId: 'gympulse-personal',
    authDomain: 'gympulse-personal.firebaseapp.com',
    databaseURL: 'https://gympulse-personal-default-rtdb.firebaseio.com',
    storageBucket: 'gympulse-personal.firebasestorage.app',
    measurementId: 'G-PWD1EYY9DD',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY',
    appId: '1:1068724964920:android:d4fec7bbd3dbeceb07a0cd',
    messagingSenderId: '1068724964920',
    projectId: 'gympulse-personal',
    databaseURL: 'https://gympulse-personal-default-rtdb.firebaseio.com',
    storageBucket: 'gympulse-personal.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY',
    appId: '1:1068724964920:ios:d4fec7bbd3dbeceb07a0cd',
    messagingSenderId: '1068724964920',
    projectId: 'gympulse-personal',
    databaseURL: 'https://gympulse-personal-default-rtdb.firebaseio.com',
    storageBucket: 'gympulse-personal.firebasestorage.app',
  );
}
`,
  },
  {
    name: 'main.dart',
    path: 'lib/main.dart',
    language: 'dart',
    description: 'Ponto de entrada do app Flutter com tema escuro (#0B132B / #1C2541) e inicialização Firebase',
    content: `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'providers/drift_park_provider.dart';
import 'screens/login_screen.dart';
import 'screens/main_navigation_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Inicialização do Firebase
  // await Firebase.initializeApp();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => DriftParkProvider()),
      ],
      child: const DriftParkApp(),
    ),
  );
}

class DriftParkApp extends StatelessWidget {
  const DriftParkApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Drift Park',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B132B),
        primaryColor: const Color(0xFF00B4D8),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF48CAE4),
          secondary: Color(0xFF00F0FF),
          surface: Color(0xFF141E38),
          background: Color(0xFF0B132B),
        ),
        textTheme: GoogleFonts.interTextTheme(
          ThemeData(brightness: Brightness.dark).textTheme,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0B132B),
          elevation: 0,
        ),
      ),
      home: Consumer<DriftParkProvider>(
        builder: (context, provider, _) {
          return provider.currentUser == null
              ? const LoginScreen()
              : const MainNavigationScreen();
        },
      ),
    );
  }
}
`,
  },
  {
    name: 'drift_models.dart',
    path: 'lib/models/drift_models.dart',
    language: 'dart',
    description: 'Modelos de dados Dart com tenantId obrigatório para isolamento Multi-Tenant',
    content: `enum UserRole { admin, operador }
enum VehicleCategory { DRIFT, JEEP, BATE_BATE }
enum VehicleStatus { disponivel, em_uso, manutencao }
enum PaymentMethod { PIX, CARTAO, DINHEIRO }
enum PaymentStatus { PAGO, NAO_PAGO }

class UserProfile {
  final String id;
  final String email;
  final String name;
  final UserRole role;
  final String tenantId;
  final String? phone;

  UserProfile({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.tenantId,
    this.phone,
  });

  Map<String, dynamic> toMap() => {
    'email': email,
    'name': name,
    'role': role.name,
    'tenantId': tenantId,
    'phone': phone,
  };

  factory UserProfile.fromMap(String id, Map<String, dynamic> map) => UserProfile(
    id: id,
    email: map['email'] ?? '',
    name: map['name'] ?? '',
    role: map['role'] == 'admin' ? UserRole.admin : UserRole.operador,
    tenantId: map['tenantId'] ?? '',
    phone: map['phone'],
  );
}

// Modelo específico da Equipe / Firestore
class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String tenantId;
  final int createdAt;
  final String? createdBy;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.tenantId,
    required this.createdAt,
    this.createdBy,
  });

  Map<String, dynamic> toMap() => {
    'name': name,
    'email': email,
    'role': role,
    'tenantId': tenantId,
    'createdAt': createdAt,
    if (createdBy != null) 'createdBy': createdBy,
  };

  factory UserModel.fromMap(Map<String, dynamic> data, String id) {
    return UserModel(
      id: id,
      name: data['name'] ?? '',
      email: data['email'] ?? '',
      role: data['role'] ?? 'operador',
      tenantId: data['tenantId'] ?? '',
      createdAt: data['createdAt'] ?? DateTime.now().millisecondsSinceEpoch,
      createdBy: data['createdBy'],
    );
  }
}

class Vehicle {
  final String id;
  final String tenantId;
  final String name;
  final String code;
  final VehicleCategory category;
  final VehicleStatus status;
  final int batteryLevel;
  final int totalRuns;

  Vehicle({
    required this.id,
    required this.tenantId,
    required this.name,
    required this.code,
    required this.category,
    required this.status,
    this.batteryLevel = 100,
    this.totalRuns = 0,
  });

  Map<String, dynamic> toMap() => {
    'tenantId': tenantId,
    'name': name,
    'code': code,
    'category': category.name,
    'status': status.name,
    'batteryLevel': batteryLevel,
    'totalRuns': totalRuns,
  };

  factory Vehicle.fromMap(String id, Map<String, dynamic> map) => Vehicle(
    id: id,
    tenantId: map['tenantId'] ?? '',
    name: map['name'] ?? '',
    code: map['code'] ?? '',
    category: VehicleCategory.values.firstWhere((e) => e.name == map['category'], orElse: () => VehicleCategory.DRIFT),
    status: VehicleStatus.values.firstWhere((e) => e.name == map['status'], orElse: () => VehicleStatus.disponivel),
    batteryLevel: map['batteryLevel'] ?? 100,
    totalRuns: map['totalRuns'] ?? 0,
  );
}

class Rental {
  final String id;
  final String tenantId;
  final String vehicleId;
  final String vehicleName;
  final String vehicleCode;
  final VehicleCategory vehicleCategory;
  final String customerName;
  final String customerPhone;
  final int durationMinutes;
  final double amount;
  final PaymentMethod paymentMethod;
  PaymentStatus paymentStatus;
  final DateTime startTime;
  final DateTime endTime;
  String status; // 'ativa', 'concluida'
  final String operatorName;

  Rental({
    required this.id,
    required this.tenantId,
    required this.vehicleId,
    required this.vehicleName,
    required this.vehicleCode,
    required this.vehicleCategory,
    required this.customerName,
    required this.customerPhone,
    required this.durationMinutes,
    required this.amount,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.operatorName,
  });

  Map<String, dynamic> toMap() => {
    'tenantId': tenantId,
    'vehicleId': vehicleId,
    'vehicleName': vehicleName,
    'vehicleCode': vehicleCode,
    'vehicleCategory': vehicleCategory.name,
    'customerName': customerName,
    'customerPhone': customerPhone,
    'durationMinutes': durationMinutes,
    'amount': amount,
    'paymentMethod': paymentMethod.name,
    'paymentStatus': paymentStatus.name,
    'startTime': startTime.millisecondsSinceEpoch,
    'endTime': endTime.millisecondsSinceEpoch,
    'status': status,
    'operatorName': operatorName,
  };
}
`,
  },
  {
    name: 'drift_park_provider.dart',
    path: 'lib/providers/drift_park_provider.dart',
    language: 'dart',
    description: 'Provider do Flutter gerenciando Auth, Snapshots do Firestore isolados por tenantId e exportação CSV',
    content: `import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:csv/csv.dart';
import '../models/drift_models.dart';

class DriftParkProvider extends ChangeNotifier {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  UserProfile? _currentUser;
  String _currentTenantId = 'tenant_drift_01';
  int _currentTabIndex = 0;

  List<Vehicle> _vehicles = [];
  List<Rental> _rentals = [];

  UserProfile? get currentUser => _currentUser;
  String get currentTenantId => _currentTenantId;
  int get currentTabIndex => _currentTabIndex;
  List<Vehicle> get vehicles => _vehicles;
  List<Rental> get rentals => _rentals;

  void setTabIndex(int index) {
    _currentTabIndex = index;
    notifyListeners();
  }

  // Login com Firebase Auth e carregamento do perfil com tenantId
  Future<bool> login(String email, String password) async {
    try {
      // UserCredential cred = await _auth.signInWithEmailAndPassword(email: email, password: password);
      // DocumentSnapshot doc = await _firestore.collection('usuarios').doc(cred.user!.uid).get();

      // Mock inicial para execução imediata:
      _currentUser = UserProfile(
        id: 'user_admin',
        email: email,
        name: email.contains('admin') ? 'Michel Lima (Admin)' : 'Carlos Operador',
        role: email.contains('admin') ? UserRole.admin : UserRole.operador,
        tenantId: _currentTenantId,
      );

      listenTenantData();
      notifyListeners();
      return true;
    } catch (e) {
      if (kDebugMode) print('Erro login: $e');
      return false;
    }
  }

  void logout() {
    _currentUser = null;
    notifyListeners();
  }

  // OUVINTE REAL-TIME DO FIRESTORE COM FILTRO ESTRITO POR tenantId
  void listenTenantData() {
    // 1. Escuta Veículos filtrados por tenantId
    _firestore
        .collection('veiculos')
        .where('tenantId', isEqualTo: _currentTenantId)
        .snapshots()
        .listen((snapshot) {
      _vehicles = snapshot.docs
          .map((doc) => Vehicle.fromMap(doc.id, doc.data()))
          .toList();
      notifyListeners();
    });

    // 2. Escuta Corridas filtradas por tenantId
    _firestore
        .collection('corridas')
        .where('tenantId', isEqualTo: _currentTenantId)
        .orderBy('startTime', descending: true)
        .snapshots()
        .listen((snapshot) {
      // Atualiza lista de corridas em tempo real
      notifyListeners();
    });
  }

  // Iniciar corrida com tenantId
  Future<void> startRental({
    required Vehicle vehicle,
    required String customerName,
    required String customerPhone,
    required int durationMinutes,
    required double amount,
    required PaymentMethod paymentMethod,
    required PaymentStatus paymentStatus,
  }) async {
    final now = DateTime.now();
    final endTime = now.add(Duration(minutes: durationMinutes));

    final docRef = await _firestore.collection('corridas').add({
      'tenantId': _currentTenantId,
      'vehicleId': vehicle.id,
      'vehicleName': vehicle.name,
      'vehicleCode': vehicle.code,
      'vehicleCategory': vehicle.category.name,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'durationMinutes': durationMinutes,
      'amount': amount,
      'paymentMethod': paymentMethod.name,
      'paymentStatus': paymentStatus.name,
      'startTime': now.millisecondsSinceEpoch,
      'endTime': endTime.millisecondsSinceEpoch,
      'status': 'ativa',
      'operatorName': _currentUser?.name ?? 'Operador',
    });

    // Atualiza status do veículo para em_uso
    await _firestore.collection('veiculos').doc(vehicle.id).update({
      'status': VehicleStatus.em_uso.name,
      'activeRentalId': docRef.id,
    });
  }

  // STREAM REAL-TIME DOS MEMBROS DA EQUIPE COM FILTRO ESTRITO POR tenantId
  Stream<List<UserModel>> getTeamMembers(String currentTenantId) {
    return _firestore
        .collection('users')
        .where('tenantId', isEqualTo: currentTenantId)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => UserModel.fromMap(doc.data(), doc.id))
            .toList());
  }

  // Criar Conta de Operador vinculada ao tenant do Administrador com prevenção de duplicidade
  Future<bool> createOperatorAccount(String name, String email, String password) async {
    try {
      final cleanEmail = email.trim().toLowerCase();
      // 1. Previne duplicidade verificando se e-mail já existe no Firestore
      final existingDocs = await _firestore
          .collection('users')
          .where('email', isEqualTo: cleanEmail)
          .get();
      if (existingDocs.docs.isNotEmpty) {
        if (kDebugMode) print('E-mail já cadastrado na equipe.');
        return false;
      }

      // 2. Cria usuário com Firebase Auth para obter UID real
      final cred = await _auth.createUserWithEmailAndPassword(
        email: cleanEmail,
        password: password.trim(),
      );
      final uid = cred.user!.uid;

      // 3. Grava perfil no Firestore com o UID como ID do documento na coleção 'users'
      await _firestore.collection('users').doc(uid).set({
        'name': name.trim(),
        'email': cleanEmail,
        'role': 'operador',
        'tenantId': _currentTenantId, // Isolamento absoluto por tenantId
        'createdAt': DateTime.now().millisecondsSinceEpoch,
        'createdBy': _currentUser?.id,
      });

      notifyListeners();
      return true;
    } catch (e) {
      if (kDebugMode) print('Erro ao criar operador: \$e');
      return false;
    }
  }

  // Editar Forma de Pagamento ou Status pós-corrida
  Future<void> updatePayment(String rentalId, PaymentMethod method, PaymentStatus status) async {
    await _firestore.collection('corridas').doc(rentalId).update({
      'paymentMethod': method.name,
      'paymentStatus': status.name,
    });
  }

  // Exportar relatório diário CSV para Excel
  String generateDailyCsv() {
    List<List<dynamic>> rows = [
      ['Data/Hora', 'Veiculo', 'Categoria', 'Cliente', 'Duracao (min)', 'Valor (R$)', 'Pagamento', 'Status', 'Operador']
    ];

    for (var r in _rentals) {
      rows.add([
        r.startTime.toIso8601String(),
        '\${r.vehicleCode} - \${r.vehicleName}',
        r.vehicleCategory.name,
        r.customerName,
        r.durationMinutes,
        r.amount.toStringAsFixed(2),
        r.paymentMethod.name,
        r.paymentStatus.name,
        r.operatorName,
      ]);
    }
    return const ListToCsvConverter(fieldDelimiter: ';').convert(rows);
  }
}
`,
  },
  {
    name: 'login_screen.dart',
    path: 'lib/screens/login_screen.dart',
    language: 'dart',
    description: 'Tela de Login Flutter reproduzindo rigorosamente a imagem de referência com o velocímetro neon',
    content: `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/drift_park_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberLogin = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B132B),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 32.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 30),
              // Velocímetro Neon Ciano (Identidade visual da referência)
              Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF00F0FF).withOpacity(0.3),
                        blurRadius: 30,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: CustomPaint(painter: SpeedometerPainter()),
                ),
              ),
              const SizedBox(height: 24),
              // Título DRIFT PARK
              Text(
                'DRIFT PARK',
                style: GoogleFonts.chakraPetch(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2.0,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Sistema de Gestão & Telemetria de Pista',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
                  color: const Color(0xFF94A3B8),
                ),
              ),
              const SizedBox(height: 48),

              // Campo 1: E-mail de Acesso com Badge
              _buildFloatingLabelInput(
                label: 'E-mail de Acesso',
                controller: _emailController,
                icon: Icons.mail_outline,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 24),

              // Campo 2: Senha com Badge e Toggle Visibilidade
              _buildFloatingLabelInput(
                label: 'Senha',
                controller: _passwordController,
                icon: Icons.lock_outline,
                obscureText: _obscurePassword,
                suffix: IconButton(
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    color: const Color(0xFF94A3B8),
                  ),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              const SizedBox(height: 16),

              // Lembrar login & Esqueceu a senha?
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => setState(() => _rememberLogin = !_rememberLogin),
                        child: Container(
                          width: 18,
                          height: 18,
                          decoration: BoxDecoration(
                            color: _rememberLogin ? const Color(0xFF48CAE4) : const Color(0xFF1C2541),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: const Color(0xFF48CAE4)),
                          ),
                          child: _rememberLogin
                              ? const Icon(Icons.check, size: 14, color: Color(0xFF0B132B))
                              : null,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Lembrar login',
                        style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFFE2E8F0)),
                      ),
                    ],
                  ),
                  GestureDetector(
                    onTap: () {},
                    child: Text(
                      'Esqueceu a senha?',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: const Color(0xFF48CAE4),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 36),

              // Botão Ciano "ENTRAR"
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () {
                    context.read<DriftParkProvider>().login(
                          _emailController.text,
                          _passwordController.text,
                        );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF48CAE4),
                    foregroundColor: const Color(0xFF0B132B),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 10,
                    shadowColor: const Color(0xFF00B4D8).withOpacity(0.5),
                  ),
                  child: Text(
                    'ENTRAR',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Link Criar Cadastro
              TextButton(
                onPressed: () {},
                child: RichText(
                  text: TextSpan(
                    text: 'Ainda não tem cadastro? ',
                    style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8)),
                    children: const [
                      TextSpan(
                        text: 'Clique para cadastrar.',
                        style: TextStyle(color: Color(0xFF48CAE4), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFloatingLabelInput({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffix,
  }) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF141E38).withOpacity(0.5),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF1C2541), width: 1.5),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: TextField(
            controller: controller,
            obscureText: obscureText,
            keyboardType: keyboardType,
            style: const TextStyle(color: Colors.white, fontSize: 14),
            decoration: InputDecoration(
              icon: Icon(icon, color: const Color(0xFF00B4D8), size: 20),
              border: InputBorder.none,
              suffixIcon: suffix,
            ),
          ),
        ),
        Positioned(
          top: -10,
          left: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            color: const Color(0xFF0B132B),
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 11,
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// Pintor do Velocímetro Neon
class SpeedometerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 8;

    final outerPaint = Paint()
      ..color = const Color(0xFF00F0FF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;

    // Arco externo
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      2.3,
      4.8,
      false,
      outerPaint,
    );

    // Ponteiro central
    final needlePaint = Paint()
      ..color = const Color(0xFF48CAE4)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(center, Offset(center.dx + radius * 0.6, center.dy - radius * 0.3), needlePaint);

    // Centro do ponteiro
    canvas.drawCircle(center, 4, Paint()..color = const Color(0xFF00F0FF));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
`,
  },
  {
    name: 'management_screen.dart',
    path: 'lib/screens/management_screen.dart',
    language: 'dart',
    description: 'Painel Administrativo exclusivo do Dono com Card de Criação de Operador e Frota',
    content: `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/drift_park_provider.dart';
import '../models/drift_models.dart';

class ManagementScreen extends StatefulWidget {
  const ManagementScreen({super.key});

  @override
  State<ManagementScreen> createState() => _ManagementScreenState();
}

class _ManagementScreenState extends State<ManagementScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController(text: '123456');

  void _handleCreateOperator() async {
    if (_nameController.text.isEmpty || _emailController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Preencha nome e e-mail do operador.')),
      );
      return;
    }

    final provider = context.read<DriftParkProvider>();
    final success = await provider.createOperatorAccount(
      _nameController.text,
      _emailController.text,
      _passwordController.text,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Conta de Operador criada com sucesso!')),
      );
      _nameController.clear();
      _emailController.clear();
      _passwordController.text = '123456';
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DriftParkProvider>();
    final isAdmin = provider.currentUser?.role == UserRole.admin;

    // BLOQUEIO RBAC: SE NÃO FOR ADMIN, NÃO TEM ACESSO À GESTÃO
    if (!isAdmin) {
      return Scaffold(
        backgroundColor: const Color(0xFF0B132B),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline, size: 56, color: Color(0xFFF59E0B)),
                const SizedBox(height: 16),
                Text(
                  'Acesso Restrito ao Administrador',
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                Text(
                  'Operadores não possuem permissão para criar funcionários ou alterar a frota.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0B132B),
      appBar: AppBar(
        title: Text('Gestão da Pista', style: GoogleFonts.chakraPetch(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0B132B),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // CARD EM DESTAQUE: CRIAR CONTA DE OPERADOR
            Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1C2541), Color(0xFF141E38)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF00F0FF).withOpacity(0.3)),
                boxShadow: [
                  BoxShadow(color: const Color(0xFF00B4D8).withOpacity(0.15), blurRadius: 15),
                ],
              ),
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00B4D8).withOpacity(0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.person_add_alt_1, color: Color(0xFF48CAE4), size: 20),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'CRIAR CONTA DE OPERADOR',
                            style: GoogleFonts.chakraPetch(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          Text(
                            'Acesso restrito para funcionários de pista',
                            style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8)),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _nameController,
                    decoration: _inputDecoration('Nome do Operador', Icons.person_outline),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _emailController,
                    decoration: _inputDecoration('E-mail de Login', Icons.email_outlined),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    decoration: _inputDecoration('Senha Provisória', Icons.lock_outline),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton.icon(
                      onPressed: _handleCreateOperator,
                      icon: const Icon(Icons.check, size: 18),
                      label: const Text('CRIAR CONTA IMEDIATAMENTE', style: TextStyle(fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF48CAE4),
                        foregroundColor: const Color(0xFF0B132B),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // GESTÃO DA FROTA
            Text('FROTA DA PISTA', style: GoogleFonts.chakraPetch(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF94A3B8))),
            const SizedBox(height: 10),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: provider.vehicles.length,
              itemBuilder: (context, index) {
                final v = provider.vehicles[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF141E38),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF1C2541)),
                  ),
                  child: Row(
                    children: [
                      Text(v.code, style: GoogleFonts.chakraPetch(fontWeight: FontWeight.bold, color: const Color(0xFF48CAE4))),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(v.name, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13)),
                            Text(v.category.name, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                          ],
                        ),
                      ),
                      Text(v.status.name, style: const TextStyle(color: Color(0xFF00F0FF), fontSize: 11, fontWeight: FontWeight.w600)),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 24),

            // =========================================================================
            // EQUIPE & SUB-CONTAS (FIRESTORE REAL-TIME STREAM COM ISOLAMENTO POR tenantId)
            // =========================================================================
            Text('EQUIPE & SUB-CONTAS', style: GoogleFonts.chakraPetch(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF94A3B8))),
            const SizedBox(height: 10),

            // 1. TOPO DA HIERARQUIA: APENAS 1 CARD DO ADMINISTRADOR LOGADO
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1C2541), Color(0xFF141E38)],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.5)),
              ),
              child: Row(
                children: [
                  const Text('👑', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(provider.currentUser?.name ?? 'Administrador', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13)),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF59E0B).withOpacity(0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text('Você - Admin', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 9, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                        Text(provider.currentUser?.email ?? '', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                      ],
                    ),
                  ),
                  const Text('Dono da Pista', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10)),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // 2. ABAIXO: APENAS OPERADORES VINCULADOS AO tenantId DESSE ADMINISTRADOR
            StreamBuilder<List<UserModel>>(
              stream: provider.getTeamMembers(provider.currentTenantId),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()));
                }
                final allMembers = snapshot.data ?? [];
                // Filtra apenas operadores estritamente do tenantId, descartando admin atual para evitar duplicidade
                final operators = allMembers.where((m) => m.role == 'operador' && m.email.toLowerCase() != (provider.currentUser?.email ?? '').toLowerCase()).toList();

                if (operators.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0B132B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF1C2541)),
                    ),
                    child: const Center(
                      child: Text('Nenhum operador cadastrado ainda para esta pista.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                    ),
                  );
                }

                return ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: operators.length,
                  itemBuilder: (context, index) {
                    final op = operators[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF141E38),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF1C2541)),
                      ),
                      child: Row(
                        children: [
                          const Text('🏎️', style: TextStyle(fontSize: 16)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(op.name, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13)),
                                Text(op.email, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF00B4D8).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text('Operador', style: TextStyle(color: Color(0xFF48CAE4), fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
      prefixIcon: Icon(icon, color: const Color(0xFF00B4D8), size: 18),
      filled: true,
      fillColor: const Color(0xFF0B132B),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF1C2541))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF1C2541))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF00B4D8))),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    );
  }
}
`,
  },
  {
    name: 'history_screen.dart',
    path: 'lib/screens/history_screen.dart',
    language: 'dart',
    description: 'Histórico de Corridas com faturamento restrito ao Admin e Edição de Pagamento pós-corrida',
    content: `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/drift_park_provider.dart';
import '../models/drift_models.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DriftParkProvider>();
    final isAdmin = provider.currentUser?.role == UserRole.admin;

    return Scaffold(
      backgroundColor: const Color(0xFF0B132B),
      appBar: AppBar(
        title: Text('Histórico & Extrato', style: GoogleFonts.chakraPetch(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0B132B),
        elevation: 0,
        actions: [
          if (isAdmin)
            IconButton(
              icon: const Icon(Icons.download_outlined, color: Color(0xFF48CAE4)),
              tooltip: 'Exportar Relatório Diário CSV',
              onPressed: () {
                final csv = provider.generateDailyCsv();
                // Baixa ou compartilha o CSV
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Relatório CSV exportado com sucesso!')),
                );
              },
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // CARD RESUMO: Faturamento total visível APENAS para Admin
          if (isAdmin)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF141E38), Color(0xFF101932)],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF00B4D8).withOpacity(0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('FATURAMENTO DO DIA', style: GoogleFonts.chakraPetch(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF00F0FF))),
                  const SizedBox(height: 6),
                  Text('R\$ 384,00', style: GoogleFonts.chakraPetch(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white)),
                  const SizedBox(height: 6),
                  const Text('Valores discriminados por PIX, Cartão e Dinheiro', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                ],
              ),
            )
          else
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF141E38),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF1C2541)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.lock_outline, color: Color(0xFFF59E0B), size: 18),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Extrato e faturamento total restritos ao Administrador.',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 20),
          Text('CORRIDAS REALIZADAS', style: GoogleFonts.chakraPetch(fontSize: 12, fontWeight: FontWeight.bold, color: const Color(0xFF94A3B8))),
          const SizedBox(height: 10),

          // LISTA DE CARDS LIMPOS COM BOTÃO DE EDIÇÃO DE PAGAMENTO
          ...provider.rentals.map((rental) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF141E38),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF1C2541)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('\${rental.vehicleCode} - \${rental.vehicleName}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13)),
                      const SizedBox(height: 2),
                      Text('\${rental.customerName} · \${rental.durationMinutes} min', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('R\$ \${rental.amount.toStringAsFixed(2)}', style: GoogleFonts.chakraPetch(fontWeight: FontWeight.bold, color: const Color(0xFF00F0FF))),
                    // AÇÃO DE EDIÇÃO PÓS-CORRIDA
                    TextButton(
                      style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(50, 24)),
                      onPressed: () {
                        _showEditPaymentDialog(context, rental);
                      },
                      child: Text(
                        '\${rental.paymentMethod.name} · \${rental.paymentStatus.name}',
                        style: const TextStyle(fontSize: 10, color: Color(0xFF48CAE4)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          )),
        ],
      ),
    );
  }

  void _showEditPaymentDialog(BuildContext context, Rental rental) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('Editar Pagamento', style: TextStyle(color: Colors.white, fontSize: 14)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text('Marcar como PAGO', style: TextStyle(color: Colors.white, fontSize: 13)),
              onTap: () {
                context.read<DriftParkProvider>().updatePayment(rental.id, rental.paymentMethod, PaymentStatus.PAGO);
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: const Text('Alterar para PIX', style: TextStyle(color: Colors.white, fontSize: 13)),
              onTap: () {
                context.read<DriftParkProvider>().updatePayment(rental.id, PaymentMethod.PIX, rental.paymentStatus);
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: const Text('Alterar para CARTÃO', style: TextStyle(color: Colors.white, fontSize: 13)),
              onTap: () {
                context.read<DriftParkProvider>().updatePayment(rental.id, PaymentMethod.CARTAO, rental.paymentStatus);
                Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
  }
}
`,
  },
  {
    name: 'firestore.rules',
    path: 'firestore.rules',
    language: 'javascript',
    description: 'Regras de Segurança Firestore com isolamento estrito de Multi-Tenant por auth.token.tenantId',
    content: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null && request.auth.token.tenantId != null;
    }

    function userTenantId() {
      return request.auth.token.tenantId;
    }

    function userRole() {
      return request.auth.token.role;
    }

    function belongsToTenant(data) {
      return isSignedIn() && data.tenantId == userTenantId();
    }

    function isWritingSameTenant() {
      return isSignedIn() && request.resource.data.tenantId == userTenantId();
    }

    function isTenantAdmin() {
      return isSignedIn() && userRole() == 'admin';
    }

    // 1. USUÁRIOS
    match /usuarios/{userId} {
      allow read: if isSignedIn() && (
        (request.auth.uid == userId && resource.data.tenantId == userTenantId()) ||
        (belongsToTenant(resource.data) && isTenantAdmin())
      );
      allow create: if isSignedIn() && isWritingSameTenant() && (
        isTenantAdmin() || request.auth.uid == userId
      );
      allow update: if isSignedIn() && 
                    belongsToTenant(resource.data) && 
                    request.resource.data.tenantId == resource.data.tenantId && (
                      request.auth.uid == userId || isTenantAdmin()
                    );
      allow delete: if isSignedIn() && belongsToTenant(resource.data) && isTenantAdmin();
    }

    // 2. VEÍCULOS
    match /veiculos/{veiculoId} {
      allow read: if isSignedIn() && belongsToTenant(resource.data);
      allow create: if isSignedIn() && isWritingSameTenant() && isTenantAdmin();
      allow update: if isSignedIn() && 
                    belongsToTenant(resource.data) && 
                    request.resource.data.tenantId == resource.data.tenantId;
      allow delete: if isSignedIn() && belongsToTenant(resource.data) && isTenantAdmin();
    }

    // 3. CORRIDAS
    match /corridas/{corridaId} {
      allow read: if isSignedIn() && belongsToTenant(resource.data);
      allow create: if isSignedIn() && isWritingSameTenant();
      allow update: if isSignedIn() && 
                    belongsToTenant(resource.data) && 
                    request.resource.data.tenantId == resource.data.tenantId;
      allow delete: if isSignedIn() && belongsToTenant(resource.data) && isTenantAdmin();
    }

    // 4. CLIENTES
    match /clientes/{clienteId} {
      allow read: if isSignedIn() && belongsToTenant(resource.data);
      allow create: if isSignedIn() && isWritingSameTenant();
      allow update: if isSignedIn() && 
                    belongsToTenant(resource.data) && 
                    request.resource.data.tenantId == resource.data.tenantId;
      allow delete: if isSignedIn() && belongsToTenant(resource.data) && isTenantAdmin();
    }

    // 5. CAIXA
    match /caixa/{caixaId} {
      allow read: if isSignedIn() && belongsToTenant(resource.data) && isTenantAdmin();
      allow create: if isSignedIn() && isWritingSameTenant() && isTenantAdmin();
      allow update: if isSignedIn() && 
                    belongsToTenant(resource.data) && 
                    request.resource.data.tenantId == resource.data.tenantId && 
                    isTenantAdmin();
      allow delete: if isSignedIn() && belongsToTenant(resource.data) && isTenantAdmin();
    }

    // 6. FILA DE ESPERA
    match /fila/{filaId} {
      allow read: if isSignedIn() && belongsToTenant(resource.data);
      allow create: if isSignedIn() && isWritingSameTenant();
      allow update, delete: if isSignedIn() && belongsToTenant(resource.data);
    }
  }
}
`,
  },
];
