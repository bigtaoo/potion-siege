import GameKit
import UIKit

// Game Center for the bridge (docs/ios.md "Game Center", bridge v3): which player is signed in, so
// the save copies on our server (src/save/saveCopies.ts) follow the player to a new phone or a
// reinstall. Ported from D:\standing's GameCenter, without the signed identity.
// Authentication starts at launch, so a player signed in to Game Center in Settings is signed in
// silently. When Apple hands back its sign-in sheet instead, it is kept and never shown at launch:
// only a tap may bring it up, through signIn().
final class GameCenter {

    struct State: Equatable {
        /// GKLocalPlayer.alias, the nickname the player chose (displayName can be a real name).
        let alias: String?
        /// teamPlayerID: the same player across this team's games and devices; nil when signed out.
        let player: String?
        /// Whether Apple's sign-in sheet is waiting for a tap.
        let canSignIn: Bool

        var json: [String: Any] { ["alias": alias ?? NSNull(), "player": player ?? NSNull(), "canSignIn": canSignIn] }
    }

    /// The last answer, nil until GameKit has given one.
    private(set) var state: State?
    /// Called on the main thread whenever the state changes.
    var onChange: ((State) -> Void)?
    /// Presents the sign-in sheet.
    weak var presenter: UIViewController?

    private var signInSheet: UIViewController?

    func start() {
        // GameKit calls this again whenever the account changes (signed in or out in Settings
        // while the game was in the background, or after the sheet)
        GKLocalPlayer.local.authenticateHandler = { [weak self] sheet, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.signInSheet = sheet
                let local = GKLocalPlayer.local
                let player = local.isAuthenticated && !local.teamPlayerID.isEmpty ? local.teamPlayerID : nil
                let alias = player != nil && !local.alias.isEmpty ? local.alias : nil
                self.publish(State(alias: alias, player: player, canSignIn: player == nil && sheet != nil))
            }
        }
    }

    /// Shows Apple's sign-in sheet, only ever from a tap. Its outcome comes back through the
    /// handler; with no sheet to show, the current state is published again so the page settles.
    func signIn() {
        guard let sheet = signInSheet, let presenter, presenter.presentedViewController == nil else {
            if let state { onChange?(state) }
            return
        }
        signInSheet = nil
        presenter.present(sheet, animated: true)
    }

    private func publish(_ next: State) {
        guard next != state else { return }
        state = next
        onChange?(next)
    }
}
