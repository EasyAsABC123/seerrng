import XCTest

final class ServerSetupUITests: XCTestCase {
    func testFirstLaunchCanAddAndSaveAnHTTPSSeerrNGServer() {
        let app = XCUIApplication()
        app.launchArguments.append("-reset-server-data")
        app.launch()

        let addButton = app.buttons["addServerButton"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 5))
        addButton.tap()

        let nameField = app.textFields["serverNameField"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.tap()
        nameField.typeText("Home server")

        let addressField = app.textFields["serverURLField"]
        addressField.tap()
        addressField.typeText("media.example.test/library/")
        app.buttons["saveServerButton"].tap()

        XCTAssertTrue(app.staticTexts["Home server"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["https://media.example.test/library"].exists)
    }

    func testHTTPRequiresAnExplicitWarningConfirmation() {
        let app = XCUIApplication()
        app.launchArguments.append("-reset-server-data")
        app.launch()
        app.buttons["addServerButton"].tap()

        let nameField = app.textFields["serverNameField"]
        nameField.tap()
        nameField.typeText("Local server")
        let addressField = app.textFields["serverURLField"]
        addressField.tap()
        addressField.typeText("http://192.168.1.5:5055")
        app.buttons["saveServerButton"].tap()

        let warning = app.alerts["Use an unencrypted HTTP connection?"]
        XCTAssertTrue(warning.waitForExistence(timeout: 3))
        warning.buttons["Use HTTP"].tap()

        XCTAssertTrue(app.staticTexts["Local server"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["HTTP is not encrypted"].exists)
    }

    func testCanKeepMultipleServersAndEditOrRemoveOne() {
        let app = XCUIApplication()
        app.launchArguments.append("-reset-server-data")
        app.launch()
        app.buttons["addServerButton"].tap()

        app.textFields["serverNameField"].tap()
        app.textFields["serverNameField"].typeText("Home")
        app.textFields["serverURLField"].tap()
        app.textFields["serverURLField"].typeText("home.example.test")
        app.buttons["saveServerButton"].tap()
        waitForSavedServer("Home", in: app)

        app.buttons["addServerToolbarButton"].tap()
        let nameField = app.textFields["serverNameField"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 20))
        nameField.tap()
        nameField.typeText("Office")
        let addressField = app.textFields["serverURLField"]
        XCTAssertTrue(addressField.waitForExistence(timeout: 20))
        addressField.tap()
        addressField.typeText("office.example.test")
        app.buttons["saveServerButton"].tap()
        waitForSavedServer("Office", in: app)

        app.buttons["Actions for Office"].tap()
        app.buttons["Edit"].tap()
        XCTAssertTrue(nameField.waitForExistence(timeout: 20))
        nameField.tap()
        nameField.clearAndEnterText("Work")
        app.buttons["saveServerButton"].tap()
        waitForSavedServer("Work", in: app)
        XCTAssertTrue(app.staticTexts["Home"].exists)

        app.buttons["Actions for Work"].tap()
        app.buttons["Delete Work"].tap()
        let deletionAlert = app.alerts["Delete server?"]
        XCTAssertTrue(deletionAlert.waitForExistence(timeout: 3))
        deletionAlert.buttons["Delete"].tap()

        app.terminate()
        let relaunchedApp = XCUIApplication()
        relaunchedApp.launch()
        XCTAssertTrue(relaunchedApp.staticTexts["Home"].waitForExistence(timeout: 5))
        XCTAssertFalse(relaunchedApp.staticTexts["Work"].exists)
    }

    private func waitForSavedServer(_ name: String, in app: XCUIApplication) {
        let saveButton = app.buttons["saveServerButton"]
        XCTAssertTrue(saveButton.waitForNonExistence(timeout: 30), "The server editor should close after saving \(name).")
        XCTAssertTrue(app.staticTexts[name].waitForExistence(timeout: 30), "The server list should show \(name) after saving.")
    }
}

private extension XCUIElement {
    func clearAndEnterText(_ text: String) {
        guard let currentValue = value as? String else {
            typeText(text)
            return
        }
        let delete = String(repeating: XCUIKeyboardKey.delete.rawValue, count: currentValue.count)
        typeText(delete + text)
    }
}
