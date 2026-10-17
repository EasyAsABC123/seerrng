import XCTest
@testable import SeerrNG

@MainActor
final class CappedUsageStoreTests: XCTestCase {
    func testCountsOnlyOneSuccessfulPagePerOpenSession() {
        let store = makeStore()
        store.beginSession()
        store.recordSuccessfulPageLoad(isUnlocked: false)
        store.recordSuccessfulPageLoad(isUnlocked: false)

        XCTAssertEqual(store.successfulSessions, 1)
        XCTAssertEqual(store.remainingSessions, CappedUsageStore.freeSessionLimit - 1)
    }

    func testFailedOrClosedSessionDoesNotConsumeAUse() {
        let store = makeStore()
        store.beginSession()
        store.endSession()

        XCTAssertEqual(store.successfulSessions, 0)
        XCTAssertTrue(store.canStartSession(isUnlocked: false))
    }

    func testCapBlocksTheNextSessionButNotAnUnlockedUser() {
        let store = makeStore()
        for _ in 0..<CappedUsageStore.freeSessionLimit {
            store.beginSession()
            store.recordSuccessfulPageLoad(isUnlocked: false)
            store.endSession()
        }

        XCTAssertEqual(store.remainingSessions, 0)
        XCTAssertFalse(store.canStartSession(isUnlocked: false))
        XCTAssertTrue(store.canStartSession(isUnlocked: true))
    }

    func testCountSurvivesStoreRecreation() {
        let defaults = makeDefaults()
        let first = CappedUsageStore(defaults: defaults)
        first.beginSession()
        first.recordSuccessfulPageLoad(isUnlocked: false)

        let recreated = CappedUsageStore(defaults: defaults)
        XCTAssertEqual(recreated.successfulSessions, 1)
        XCTAssertFalse(recreated.sessionIsOpen)
    }

    private func makeStore() -> CappedUsageStore {
        CappedUsageStore(defaults: makeDefaults())
    }

    private func makeDefaults() -> UserDefaults {
        let suite = "SeerrNG-CappedUsageStoreTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }
}
