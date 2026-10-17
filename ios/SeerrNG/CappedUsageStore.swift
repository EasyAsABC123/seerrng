import Combine
import Foundation

@MainActor
final class CappedUsageStore: ObservableObject {
    static let freeSessionLimit = 20

    @Published private(set) var successfulSessions: Int
    @Published private(set) var sessionIsOpen = false

    private let defaults: UserDefaults
    private let storageKey = "successfulServerSessions.v1"
    private var countedCurrentSession = false

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        successfulSessions = max(0, defaults.integer(forKey: storageKey))
    }

    var remainingSessions: Int {
        max(0, Self.freeSessionLimit - successfulSessions)
    }

    func canStartSession(isUnlocked: Bool) -> Bool {
        isUnlocked || sessionIsOpen || successfulSessions < Self.freeSessionLimit
    }

    func beginSession() {
        sessionIsOpen = true
        countedCurrentSession = false
    }

    func recordSuccessfulPageLoad(isUnlocked: Bool) {
        guard sessionIsOpen, !countedCurrentSession else { return }
        countedCurrentSession = true
        guard !isUnlocked else { return }
        successfulSessions += 1
        defaults.set(successfulSessions, forKey: storageKey)
    }

    func endSession() {
        sessionIsOpen = false
        countedCurrentSession = false
    }
}
