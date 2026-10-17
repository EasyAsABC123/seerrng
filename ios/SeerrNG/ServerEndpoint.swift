import Foundation

struct ServerEndpoint: Codable, Equatable, Identifiable {
    let id: UUID
    var name: String
    var urlString: String
    var httpWarningAccepted: Bool

    var url: URL {
        // Values are normalized and validated before they are persisted.
        URL(string: urlString)!
    }

    var usesHTTPS: Bool {
        url.scheme?.lowercased() == "https"
    }

    init(
        id: UUID = UUID(),
        name: String,
        urlString: String,
        httpWarningAccepted: Bool = false
    ) {
        self.id = id
        self.name = name
        self.urlString = urlString
        self.httpWarningAccepted = httpWarningAccepted
    }

    static func create(
        id: UUID = UUID(),
        name: String,
        address: String,
        httpWarningAccepted: Bool = false
    ) throws -> ServerEndpoint {
        let cleanedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanedName.isEmpty else { throw ServerEndpointError.emptyName }

        let input = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !input.isEmpty, !input.contains(where: \.isWhitespace) else {
            throw ServerEndpointError.invalidAddress
        }

        let candidate = input.contains("://") ? input : "https://\(input)"
        guard var components = URLComponents(string: candidate),
              let scheme = components.scheme?.lowercased(),
              let host = components.host?.trimmingCharacters(in: .whitespacesAndNewlines),
              !host.isEmpty
        else {
            throw ServerEndpointError.invalidAddress
        }

        guard scheme == "http" || scheme == "https" else {
            throw ServerEndpointError.unsupportedScheme
        }
        guard components.user == nil, components.password == nil else {
            throw ServerEndpointError.credentialsInAddress
        }
        guard components.query == nil, components.fragment == nil else {
            throw ServerEndpointError.queryOrFragment
        }
        if let port = components.port, !(1...65_535).contains(port) {
            throw ServerEndpointError.invalidPort
        }

        components.scheme = scheme
        components.host = host.lowercased()
        if (scheme == "https" && components.port == 443) ||
            (scheme == "http" && components.port == 80) {
            components.port = nil
        }

        var path = components.percentEncodedPath
        while path.count > 1 && path.hasSuffix("/") {
            path.removeLast()
        }
        if path == "/" { path = "" }
        components.percentEncodedPath = path

        guard let url = components.url, url.host != nil else {
            throw ServerEndpointError.invalidAddress
        }

        return ServerEndpoint(
            id: id,
            name: cleanedName,
            urlString: url.absoluteString,
            httpWarningAccepted: httpWarningAccepted
        )
    }
}

enum ServerEndpointError: LocalizedError, Equatable {
    case emptyName
    case invalidAddress
    case unsupportedScheme
    case credentialsInAddress
    case queryOrFragment
    case invalidPort

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter a name for this server."
        case .invalidAddress:
            return "Enter a valid server address, such as https://media.example.com."
        case .unsupportedScheme:
            return "Server addresses must use HTTP or HTTPS."
        case .credentialsInAddress:
            return "Do not put a username or password in the server address."
        case .queryOrFragment:
            return "Remove the query string or fragment from the server address."
        case .invalidPort:
            return "The port must be between 1 and 65535."
        }
    }
}
