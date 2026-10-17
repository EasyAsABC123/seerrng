import XCTest
@testable import SeerrNG

@MainActor
final class ServerStoreTests: XCTestCase {
    func testSaveUpdateReloadAndRemoveServer() throws {
        let suite = "SeerrNG-ServerStoreTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }

        let store = ServerStore(defaults: defaults)
        let first = try ServerEndpoint.create(name: "Home", address: "home.example.test")
        store.save(first)
        store.save(try ServerEndpoint.create(id: first.id, name: "Media server", address: "home.example.test"))

        let reloaded = ServerStore(defaults: defaults)
        XCTAssertEqual(reloaded.servers.count, 1)
        XCTAssertEqual(reloaded.servers.first?.name, "Media server")
        XCTAssertEqual(reloaded.remove(id: first.id)?.id, first.id)
        XCTAssertTrue(reloaded.servers.isEmpty)
    }
}
