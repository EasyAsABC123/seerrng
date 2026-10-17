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
        XCTAssertTrue(app.staticTexts["Home"].waitForExistence(timeout: 5))

        app.buttons["addServerToolbarButton"].tap()
        app.textFields["serverNameField"].tap()
        app.textFields["serverNameField"].typeText("Office")
        app.textFields["serverURLField"].tap()
        app.textFields["serverURLField"].typeText("office.example.test")
        app.buttons["saveServerButton"].tap()
        XCTAssertTrue(app.staticTexts["Office"].waitForExistence(timeout: 5))

        app.buttons["Actions for Office"].tap()
        app.buttons["Edit"].tap()
        let nameField = app.textFields["serverNameField"]
        nameField.tap()
        nameField.clearAndEnterText("Work")
        app.buttons["saveServerButton"].tap()
        XCTAssertTrue(app.staticTexts["Work"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Home"].exists)

        app.buttons["Actions for Work"].tap()
        app.buttons["Delete"].tap()
        XCTAssertFalse(app.staticTexts["Work"].waitForExistence(timeout: 2))
        XCTAssertTrue(app.staticTexts["Home"].exists)
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
