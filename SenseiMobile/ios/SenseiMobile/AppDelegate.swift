import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "SenseiMobile",
      in: window,
      launchOptions: launchOptions
    )

    if let window, let root = window.rootViewController {
      let wrapper = SenseiStatusBarViewController(contentController: root)
      window.rootViewController = wrapper
      window.makeKeyAndVisible()
    }

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Point to a specific Metro bundler host for development.
    // Update the IP if your machine's address changes.
    return URL(string: "http://MacBook-Pro.local:8081/index.bundle?platform=ios&dev=true")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

class SenseiStatusBarViewController: UIViewController {
  private let contentController: UIViewController

  init(contentController: UIViewController) {
    self.contentController = contentController
    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) {
    return nil
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    addChild(contentController)
    contentController.view.frame = view.bounds
    contentController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(contentController.view)
    contentController.didMove(toParent: self)
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    contentController.view.frame = view.bounds
  }

  override var prefersStatusBarHidden: Bool {
    true
  }

  override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
    .fade
  }

  override var childForStatusBarHidden: UIViewController? {
    nil
  }
}
