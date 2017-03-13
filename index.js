module.exports = evaluateFileGroupsViaFolders;

function evaluateFileGroupsViaFolders(options) {
    const moduleCaption = 'folders-as-a-module';
    const moduleCaption2 = moduleCaption + ': ';
    const defaultFolderMatchingPattern = 'concat-into=*';


    const getFlattenArray = require('array-flatten');
    const pathTool = require('path');
    const getFileBaseNameFrom = pathTool.basename;


    const logger = require('@wulechuan/colorful-log');
    const formatJSON = logger.formatJSON;

    const colorfulLog = logger.log;
    const colorfulInfo = logger.info;
    const colorfulWarn = logger.warn;
    const colorfulError = logger.error;

    const infoChalk = logger.infoChalk;
    const infoEMChalk = logger.infoEMChalk;
    const warnEMChalk = logger.warnEMChalk;
    const errorEMChalk = logger.errorEMChalk;




    options = options || {};

    const taskName = (options.taskNameForLogging || '<unknown task>') + '';

    const shouldLog = !!options.shouldLog;
    const shouldNotAppendSuffix = !!options.shouldNotAppendSuffix;
    const shouldIncludeNestedEntries = !!options.shouldIncludeNestedEntries;
    const shouldEvalutateRelativePathToCWD = !!options.shouldEvalutateRelativePathToCWD;


    const validSearchingBaseGlobs = _validateSearchingBaseGlobs(options.searchingBases);
    const validFileMatchingPatterns = _validateFileMatchingPatterns(options.fileMatchingPatterns);
    const folderNameMatchingOptions = _evaluateFolderMatchingOptions(options.nameMatchingPatternForFoldersAsAModule);

    const folderNameDeeplyMatchingPattern = folderNameMatchingOptions.folderNameDeeplyMatchingPattern;
    const folderNameMatchingPatternPrefixEscaped = folderNameMatchingOptions.folderNameMatchingPatternPrefixEscaped;


    const outputFileNameSuffix = (options.outputFileNameSuffix || '') + '';
    let outputFileExtension = (options.outputFileExtension || '') + '';

    if (!outputFileExtension) {
        colorfulWarn(moduleCaption2+ 'The output file extension is not specified!');
    }

    outputFileExtension = outputFileExtension.replace(/^\.+/, '');








    let nonDuplicatedOutputFilePaths = {};

    let outputFileNameSuffixEscaped = outputFileNameSuffix.replace(/([\.\-\=\^])/g, '\\$1');

    let regExpForExt = new RegExp('\\.'+outputFileExtension+'$');
    let regExpForSuffix = new RegExp(outputFileNameSuffixEscaped+'$');


    const prefixOfAbsolutePaths = process.cwd() + '/';

    let globallyFoundFilesCount = 0;
    for (let searchingBase of validSearchingBaseGlobs) {
        _evaluateFilesForOneSearchingBaseGlob(searchingBase);
    }

    colorfulInfo(
        moduleCaption2+
        errorEMChalk(taskName),
        'matched', errorEMChalk(globallyFoundFilesCount),
        'file'+(globallyFoundFilesCount > 1 ? '' : 's'),
        'in total.'
    );



    return nonDuplicatedOutputFilePaths;



    function _validateSearchingBaseGlobs(searchingBaseGlobs) {
        if (!searchingBaseGlobs || (typeof searchingBaseGlobs !== 'string' && !Array.isArray(searchingBaseGlobs))) {
            throw TypeError(colorfulError(
                moduleCaption2+
                errorEMChalk('Invalid searching base glob(s):'),
                formatJSON(searchingBaseGlobs)
            ));
        }

        let inputItems = getFlattenArray.from(searchingBaseGlobs);
        let validItems = [];
        for (let baseGlob of inputItems) {
            baseGlob = baseGlob.trim();

            if (baseGlob.match(/^!/)) {
                colorfulWarn(
                    moduleCaption2+
                    'Invalid searching base glob',
                    '"'+warnEMChalk(baseGlob)+'"'+'.',
                    warnEMChalk('Skipped')+'.',
                    'Negative glob is simply not supported.\n'
                );
                continue;
            }

            if (!baseGlob.match(/[\/\\]$/)) {
                colorfulWarn(
                    moduleCaption2+
                    'Invalid searching base glob',
                    '"'+warnEMChalk(baseGlob)+'"'+'.',
                    warnEMChalk('Skipped')+'.',
                    '\nTip:\n    A valid searching base '+chalk.white.bgBlue('must end with single "/" or "\\"')
                    +'.\n'
                );
                continue;
            }

            validItems.push(baseGlob);
        }

        if (validItems.length < 1) {
            throw TypeError(colorfulError(
                moduleCaption2+
                'Zero valid searching base globs was found!',
                '\nThe input was:',
                formatJSON(searchingBaseGlobs)
            ));
        }

        shouldLog && colorfulInfo(
            moduleCaption2+
            'Filtered valid searching base globs:',
            formatJSON(validItems),
            '\n'
        );

        return validItems;
    }

    function _validateFileMatchingPatterns(fileMatchingPatterns) {
        let noValidItemsAtAll = !fileMatchingPatterns;

        if (!noValidItemsAtAll) {
            if (typeof fileMatchingPatterns !== 'string' && !Array.isArray(fileMatchingPatterns)) {
                throw TypeError(colorfulError(
                    errorEMChalk('Invalid file matching patterns!'),
                    formatJSON(fileMatchingPatterns)
                ));
            }

            let inputItems = getFlattenArray.from(fileMatchingPatterns);
            let validItems = [];
            for (let item of inputItems) {
                if (!item || typeof item !== 'string' || item.match(/[\\\/]/) || item.match(/\*{2,}/)) {
                    colorfulWarn(
                        moduleCaption2+
                        'Invalid file matching glob',
                        '"' + warnEMChalk(item) + '"'
                    );
                    continue;
                }

                validItems.push(item.trim());
            }

            if (validItems.length < 1) {
                noValidItemsAtAll = true;
            } else {
                return validItems;
            }
        }

        if (noValidItemsAtAll) {
            colorfulWarn(
                moduleCaption2+
                'No valid file matching glob at all! All files with all types will be matched!',
                '\nThe input was:',
                formatJSON(fileMatchingPatterns)
            );
        }

        return ['*'];
    }

    function _evaluateFolderMatchingOptions(folderNameMatchingPatternRawInput) {
        let folderNameMatchingPatternRawEvaluated;
        if (typeof folderNameMatchingPatternRawInput === 'string') {
            folderNameMatchingPatternRawEvaluated = folderNameMatchingPatternRawInput.trim();
        } else {
            folderNameMatchingPatternRawEvaluated = '';
        }

        folderNameMatchingPatternRawEvaluated = folderNameMatchingPatternRawEvaluated || defaultFolderMatchingPattern;

        let folderNameMatchingPatternPrefix = folderNameMatchingPatternRawEvaluated;

        // remove '\' or '/' chars at terminals
        folderNameMatchingPatternPrefix = folderNameMatchingPatternPrefix.replace(/[\/\\]+$/, '').replace(/^[\/\\]+/, '');

        // remove a '*' at end if found
        folderNameMatchingPatternPrefix = folderNameMatchingPatternPrefix.replace(/\*$/, '');

        // There should NOT exist any '\' or '/' in the middle of the pattern string
        if (folderNameMatchingPatternPrefix.match(/[\\\/\*\?]/)) {
            throw Error(colorfulError(
                moduleCaption2+
                'The folder name matching pattern',
                '("'+errorEMChalk(folderNameMatchingPatternRawEvaluated)+'")',
                'is invalid.',
                'It should NOT contain any "\\", "/", "?" or "*" in the middle!',
                'Nor should it contain more than one "*" at the tail.'
            ));
        }

        const folderNameMatchingPattern = folderNameMatchingPatternPrefix + '*';
        const folderNameDeeplyMatchingPattern = '**/' + folderNameMatchingPattern + '/';
        const folderNameMatchingPatternPrefixEscaped = folderNameMatchingPatternPrefix.replace(/([\.\-\=\^])/g, '\\$1');

        return {
            folderNameMatchingPattern,
            folderNameDeeplyMatchingPattern,
            folderNameMatchingPatternPrefix,
            folderNameMatchingPatternPrefixEscaped
        };
    }

    function _evaluateFilesForOneSearchingBaseGlob(searchingBaseGlob) {
        const searchingGlobs = [];
        const searchingBaseGlobItselfIsAMatch = !!getFileBaseNameFrom(searchingBaseGlob)
            .match(RegExp('^'+folderNameMatchingPatternPrefixEscaped));

        if (searchingBaseGlobItselfIsAMatch) {
            searchingGlobs.push(searchingBaseGlob);
            if (!shouldIncludeNestedEntries) {
                searchingGlobs.push('!' + searchingBaseGlob + folderNameDeeplyMatchingPattern);
            }
        } else {
            searchingGlobs.push(searchingBaseGlob + folderNameDeeplyMatchingPattern);
            if (!shouldIncludeNestedEntries) {
                searchingGlobs.push('!' + searchingBaseGlob + folderNameDeeplyMatchingPattern + folderNameDeeplyMatchingPattern);
            }
        }

        let allMatchedFoldersAsAModule = resolveGlob.sync(searchingGlobs);

        if (shouldLog) {
            colorfulLog(
                moduleCaption2+
                'Processing searching base path:',
                infoChalk(formatJSON(searchingGlobs)),
                '\n\nallMatchedFoldersAsAModule:',
                infoChalk(formatJSON(allMatchedFoldersAsAModule))
            );
        }

        for (let pathToFolderAsAModule of allMatchedFoldersAsAModule) {
            _evaluteFilesForOneFolder(searchingBaseGlob, pathToFolderAsAModule);
        }
    }

    function _evaluteFilesForOneFolder(searchingBaseGlob, pathToFolderAsAModule) {
        let outputFileName = getFileBaseNameFrom(pathToFolderAsAModule)
            .replace(new RegExp('^'+folderNameMatchingPatternPrefixEscaped), '')
            .replace(regExpForExt, '')
            .replace(regExpForSuffix, '')
        ;

        outputFileName += (shouldNotAppendSuffix ? '' : outputFileNameSuffix) + '.' + outputFileExtension;

        let outputFilePath = outputFileName;

        if (nonDuplicatedOutputFilePaths[outputFilePath]) {
            throw Error(colorfulError(
                moduleCaption2+
                'Output file path duplicated from different globs!',
                '\nThe duplicated output file path is:',
                '"' + errorEMChalk(outputFilePath) + '"\n'
            ));
        }

        const allGlobsToResolve = [];
        for (let fileMatchingPattern of validFileMatchingPatterns) {
            allGlobsToResolve.push(pathToFolderAsAModule+'/**/'+fileMatchingPattern);
        }


        // must exclude any folder or file whose name starts with an "!".
        allGlobsToResolve.push(
            '!' + prefixOfAbsolutePaths + searchingBaseGlob + '**/!*/*'
        );
        allGlobsToResolve.push(
            '!' + prefixOfAbsolutePaths + searchingBaseGlob + '**/!*'
        );



        // colorfulInfo(formatJSON(allGlobsToResolve));

        const allFilesInThisPath = resolveGlob.sync(allGlobsToResolve, {
            nodir: true,
            nosort: false
        });

        if (!shouldEvalutateRelativePathToCWD) {
            nonDuplicatedOutputFilePaths[outputFilePath] = allFilesInThisPath;
        } else {
            nonDuplicatedOutputFilePaths[outputFilePath] = allFilesInThisPath.map(function (fileFullPath) {
                return fileFullPath.replace(prefixOfAbsolutePaths, '');
            });
        }

        globallyFoundFilesCount += nonDuplicatedOutputFilePaths[outputFilePath].length;


        shouldLog && colorfulLog(
            moduleCaption2+
            'Matched files under ['+infoChalk(outputFilePath)+']:',
            infoChalk(formatJSON(nonDuplicatedOutputFilePaths[outputFilePath]))
        );
    }
}