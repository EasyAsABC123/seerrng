import XCTest
@testable import SeerrNG

final class ServerEndpointTests: XCTestCase {
    func testAddsHTTPSAndNormalizesAddress() throws {
        let server = try ServerEndpoint.create(name: " Home ", address: "Media.Example.com:443/library/")

        XCTAssertEqual(server.name, "Home")
        XCTAssertEqual(server.urlString, "https://media.example.com/library")
        XCTAssertTrue(server.usesHTTPS)
    }

    func testKeepsHTTPPortAndMarksConnectionInsecure() throws {
        let server = try ServerEndpoint.create(name: "LAN", address: "http://192.168.1.20:8096/")

        XCTAssertEqual(server.urlString, "http://192.168.1.20:8096")
        XCTAssertFalse(server.usesHTTPS)
    }

    func testRejectsCredentialsAndQueryStrings() {
        XCTAssertThrowsError(try ServerEndpoint.create(name: "Home", address: "https://user:pass@example.com")) {
            XCTAssertEqual($0 as? ServerEndpointError, .credentialsInAddress)
        }
        XCTAssertThrowsError(try ServerEndpoint.create(name: "Home", address: "https://example.com/?token=secret")) {
            XCTAssertEqual($0 as? ServerEndpointError, .queryOrFragment)
        }
    }

    func testRejectsUnsupportedSchemesAndInvalidPorts() {
        XCTAssertThrowsError(try ServerEndpoint.create(name: "Home", address: "ftp://example.com")) {
            XCTAssertEqual($0 as? ServerEndpointError, .unsupportedScheme)
        }
        XCTAssertThrowsError(try ServerEndpoint.create(name: "Home", address: "https://example.com:65536")) {
            XCTAssertEqual($0 as? ServerEndpointError, .invalidPort)
        }
    }
}
